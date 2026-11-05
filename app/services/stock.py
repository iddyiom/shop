# The business rules for the store balance, stock adjustments and the stock history.
# Spec: docs/specs/07-stock.md. No HTTP here.
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Product, ProductGroup, StockEntry, User, now_local
from app.schemas import (
    REMOVE_ONLY_REASONS, AdjustmentCreate, AdjustmentOut, StockEntryOut, StockLineOut,
)


# ---------- The one place stock goes up or down (rule 10) ----------


def change_stock(db: Session, product: Product, change: int) -> None:
    """Add `change` to the product's stock inside the database (negative = remove).

    Removing uses a guard: "take N away only if at least N are still there", so two
    requests at the same moment can never push stock below 0. Does not commit:
    the caller saves it together with its history row, as one transaction."""
    statement = update(Product).where(Product.id == product.id)
    if change < 0:
        statement = statement.where(Product.quantity_in_store >= -change)
    result = db.execute(statement.values(quantity_in_store=Product.quantity_in_store + change))

    if result.rowcount != 1:
        db.rollback()  # undo anything this transaction already did
        db.refresh(product)
        available = product.quantity_in_store
        raise AppError(
            409, "not_enough_stock", f"Not enough stock: only {available} in store",
            product_id=product.id, available=available,
        )


# ---------- Store balance ----------


def build_stock_line(product: Product) -> StockLineOut:
    return StockLineOut(
        product_id=product.id,
        product=product.name,
        group_id=product.group_id,
        group=product.group.name,
        quantity_in_store=product.quantity_in_store,
        min_level=product.min_level,
        stock_status=product.stock_status,
        is_active=product.is_active,
    )


def _active_only(query):
    """Stopped = the sub-item OR its item is stopped (rule 4)."""
    return query.where(Product.is_active.is_(True), ProductGroup.is_active.is_(True))


def list_stock(db: Session, group_id: int | None, search: str | None,
               include_stopped: bool) -> list[Product]:
    query = select(Product).join(ProductGroup).order_by(ProductGroup.name, Product.name)
    if not include_stopped:
        query = _active_only(query)
    if group_id is not None:
        query = query.where(Product.group_id == group_id)
    if search and search.strip():
        term = search.strip().lower()
        # autoescape: a "%" or "_" typed by the user is searched as a normal character.
        query = query.where(or_(
            func.lower(Product.name).contains(term, autoescape=True),
            func.lower(ProductGroup.name).contains(term, autoescape=True),
        ))
    return list(db.scalars(query))


def list_low_stock(db: Session) -> list[Product]:
    """LOW and OUT only, never stopped ones. OUT first (rule 5)."""
    query = _active_only(
        select(Product).join(ProductGroup)
        .where(Product.quantity_in_store <= Product.min_level)  # 0 always counts: min_level >= 0
        .order_by(ProductGroup.name, Product.name)
    )
    products = list(db.scalars(query))
    # sorted() keeps the name order inside each group; False (= OUT) comes before True.
    return sorted(products, key=lambda product: product.stock_status != "OUT")


# ---------- Adjustments ----------


def add_adjustment(db: Session, owner: User, product_id: int,
                   request: AdjustmentCreate) -> AdjustmentOut:
    product = db.get(Product, product_id)
    if product is None:
        raise AppError(404, "not_found", "Sub-item not found")

    # Rule 7: damaged, expired or lost goods can only leave the store.
    if request.direction == "add" and request.reason in REMOVE_ONLY_REASONS:
        raise AppError(
            422, "reason_needs_remove",
            f'"{request.reason}" can only remove stock. Use "Counted differently" to add.',
        )

    change = request.quantity if request.direction == "add" else -request.quantity
    # Stopped sub-items may still be adjusted (rule 9): no is_active check here.
    try:
        change_stock(db, product, change)
        entry = StockEntry(
            product_id=product.id,
            delivery_id=None,
            kind="adjustment",
            quantity_change=change,
            reason=request.reason,
            created_by=owner.id,
            created_at=now_local(),
        )
        db.add(entry)
        db.commit()  # stock change + history row, together
    except AppError:
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(product)
    return AdjustmentOut(
        **build_stock_entry_out(entry).model_dump(),
        before=product.quantity_in_store - change,
        after=product.quantity_in_store,
    )


# ---------- History of corrections and adjustments ----------


def build_stock_entry_out(entry: StockEntry) -> StockEntryOut:
    return StockEntryOut(
        id=entry.id,
        kind=entry.kind,
        product_id=entry.product_id,
        product=entry.product.name,
        delivery_id=entry.delivery_id,
        quantity_change=entry.quantity_change,
        reason=entry.reason,
        by=entry.creator.full_name,
        at=entry.created_at,
    )


def list_stock_entries(db: Session, product_id: int | None, kind: str | None,
                       day: date | None) -> list[StockEntry]:
    query = select(StockEntry).order_by(StockEntry.created_at.desc(), StockEntry.id.desc())
    if product_id is not None:
        query = query.where(StockEntry.product_id == product_id)
    if kind is not None:
        query = query.where(StockEntry.kind == kind)
    if day is not None:
        start = datetime.combine(day, time.min)
        query = query.where(StockEntry.created_at >= start,
                            StockEntry.created_at < start + timedelta(days=1))
    return list(db.scalars(query))
