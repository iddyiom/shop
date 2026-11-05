# The business rules for deliveries (stock arriving) and their corrections.
# Spec: docs/specs/06-deliveries.md. No HTTP here.
from datetime import date

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Delivery, DeliveryItem, Product, StockEntry, User, now_local
from app.schemas import (
    CorrectionCreate, CorrectionEntryOut, CorrectionOut, DeliveryCreate,
    DeliveryLineOut, DeliveryLineOwnerOut, DeliveryOut, DeliveryOwnerOut,
)
from app.services.stock import change_stock


def _check_can_receive(product: Product | None, product_id: int) -> Product:
    if product is None:
        raise AppError(422, "unknown_product", "Unknown product", product_id=product_id)
    if not product.is_active or not product.group.is_active:
        raise AppError(
            409, "item_stopped", f"{product.name} is stopped. Bring it back first.",
            product_id=product.id, product=product.name,
        )
    return product


def record_delivery(db: Session, receiver: User, request: DeliveryCreate) -> Delivery:
    # Rule 3: only the owner may send buying prices. Refuse, do not silently drop.
    if not receiver.is_owner and any(line.buying_price is not None for line in request.items):
        raise AppError(403, "owner_only_field", "Only the owner can enter buying prices")

    # Rule 4: default today, past allowed, future refused.
    today = now_local().date()
    delivered_at = request.delivered_at or today
    if delivered_at > today:
        raise AppError(422, "future_date", "The delivery date cannot be in the future")

    # Step 1: check EVERY line before changing anything (rule 1).
    checked = [
        (_check_can_receive(db.get(Product, line.product_id), line.product_id), line)
        for line in request.items
    ]

    # Step 2: raise stock and save the delivery as ONE transaction.
    delivery = Delivery(delivered_at=delivered_at, received_by=receiver.id, note=request.note)
    db.add(delivery)
    try:
        for product, line in checked:
            # Rule 2: the database does the adding ("stock = stock + n"),
            # so a sale at the same moment cannot be overwritten.
            db.execute(
                update(Product)
                .where(Product.id == product.id)
                .values(quantity_in_store=Product.quantity_in_store + line.quantity)
            )
            # The same product twice stays two lines (rule 5).
            delivery.items.append(DeliveryItem(
                product_id=product.id, quantity=line.quantity, buying_price=line.buying_price,
            ))
        db.commit()
    except Exception:
        db.rollback()  # undo everything in this delivery
        raise
    return delivery


def get_delivery(db: Session, delivery_id: int) -> Delivery:
    delivery = db.get(Delivery, delivery_id)
    if delivery is None:
        raise AppError(404, "not_found", "Delivery not found")
    return delivery


def list_deliveries(db: Session, day: date | None) -> list[Delivery]:
    query = select(Delivery).order_by(Delivery.delivered_at.desc(), Delivery.id.desc())
    if day is not None:
        query = query.where(Delivery.delivered_at == day)
    return list(db.scalars(query))


def add_correction(db: Session, owner: User, delivery_id: int,
                   request: CorrectionCreate) -> CorrectionOut:
    delivery = get_delivery(db, delivery_id)
    change = request.quantity_change

    # Rule 8: the sub-item must be on this delivery.
    delivered = sum(i.quantity for i in delivery.items if i.product_id == request.product_id)
    if delivered == 0:
        raise AppError(
            422, "not_on_delivery", "That product is not on this delivery",
            product_id=request.product_id,
        )

    # Rule 8: the line cannot go below 0 (delivered + all its corrections).
    corrected = sum(
        c.quantity_change for c in delivery.corrections if c.product_id == request.product_id
    )
    net = delivered + corrected
    if net + change < 0:
        raise AppError(
            409, "correction_too_big",
            f"Correction too big: only {net} recorded on this delivery", available=net,
        )

    product = db.get(Product, request.product_id)
    try:
        # Shared with adjustments (unit 7): guarded for removals, 409 if not enough stock.
        change_stock(db, product, change)

        # The delivery is never edited: the fix is a NEW row (rule 7).
        entry = StockEntry(
            product_id=product.id,
            delivery_id=delivery.id,
            kind="correction",
            quantity_change=change,
            reason=request.reason,
            created_by=owner.id,
            created_at=now_local(),
        )
        db.add(entry)
        db.commit()
    except AppError:
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(product)  # read the stock as it is now
    return CorrectionOut(
        **build_correction_entry(entry).model_dump(),
        delivery_id=delivery.id,
        before=product.quantity_in_store - change,
        after=product.quantity_in_store,
    )


def build_correction_entry(entry: StockEntry) -> CorrectionEntryOut:
    return CorrectionEntryOut(
        id=entry.id,
        product_id=entry.product_id,
        product=entry.product.name,
        quantity_change=entry.quantity_change,
        reason=entry.reason,
        by=entry.creator.full_name,
        at=entry.created_at,
    )


def build_delivery_out(delivery: Delivery, for_owner: bool) -> DeliveryOut:
    """Owner: lines with buying price. Shopkeeper: the buying_price key does not exist."""
    if for_owner:
        line_type, delivery_type = DeliveryLineOwnerOut, DeliveryOwnerOut
    else:
        line_type, delivery_type = DeliveryLineOut, DeliveryOut

    lines = [
        line_type(
            product_id=item.product_id,
            product=item.product.name,
            quantity=item.quantity,
            buying_price=item.buying_price,  # ignored by DeliveryLineOut
        )
        for item in delivery.items
    ]
    return delivery_type(
        id=delivery.id,
        delivered_at=delivery.delivered_at,
        received_by=delivery.receiver.full_name,
        note=delivery.note,
        items=lines,
        corrections=[build_correction_entry(c) for c in delivery.corrections],
    )
