# The business rules for a sale. No HTTP here: just "given this request, make a sale".
# Keeping rules out of the router makes them easy to read and to test.
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Product, Sale, SaleItem, User, now_local
from app.schemas import Receipt, ReceiptLine, SaleCreate


def check_can_sell(product: Product, quantity: int) -> None:
    """Raise the exact error the screen should show, or do nothing if the sale is OK."""
    stopped = not product.is_active or not product.group.is_active
    if stopped or product.quantity_in_store == 0:
        raise AppError(
            409, "item_not_available", "Item not available",
            product_id=product.id, product=product.name,
        )
    if quantity > product.quantity_in_store:
        available = product.quantity_in_store
        raise AppError(
            409, "item_over", f"Item over: only {available} in store",
            product_id=product.id, product=product.name, available=available,
        )


def _merge_lines(request: SaleCreate) -> dict[int, int]:
    """If the same product appears twice, add the quantities: {product_id: quantity}."""
    wanted: dict[int, int] = {}
    for line in request.items:
        wanted[line.product_id] = wanted.get(line.product_id, 0) + line.quantity
    return wanted


def record_sale(db: Session, seller: User, request: SaleCreate) -> Sale:
    # Step 1: check EVERY line before changing anything.
    # The price comes from the database, never from the screen.
    checked_lines = []
    for product_id, quantity in _merge_lines(request).items():
        product = db.get(Product, product_id)
        if product is None:
            raise AppError(422, "unknown_product", "Unknown product", product_id=product_id)
        check_can_sell(product, quantity)
        checked_lines.append((product, quantity, product.effective_price))

    # Step 2: save the sale and reduce stock as ONE transaction (all or nothing).
    sale = Sale(
        sold_by=seller.id,
        sold_at=now_local(),
        payment_method=request.payment_method,
        total=sum(quantity * unit_price for _, quantity, unit_price in checked_lines),
    )
    db.add(sale)
    try:
        for product, quantity, unit_price in checked_lines:
            # "Take N away, but ONLY IF at least N are still there."
            # If another sale took the stock a moment ago, 0 rows change.
            result = db.execute(
                update(Product)
                .where(Product.id == product.id, Product.quantity_in_store >= quantity)
                .values(quantity_in_store=Product.quantity_in_store - quantity)
            )
            if result.rowcount != 1:
                db.rollback()  # undo everything in this sale
                check_can_sell(db.get(Product, product.id), quantity)  # raises the message
                raise AppError(409, "stock_changed", "Stock changed, please try again")

            sale.items.append(
                SaleItem(
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=unit_price,  # copied, so old receipts keep old prices
                    line_total=quantity * unit_price,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return sale


def build_receipt(sale: Sale) -> Receipt:
    return Receipt(
        id=sale.id,
        sold_at=sale.sold_at,
        sold_by=sale.seller.full_name,
        payment_method=sale.payment_method,
        items=[
            ReceiptLine(
                product_id=item.product_id,
                product=item.product.name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
            )
            for item in sale.items
        ],
        total=sale.total,
    )
