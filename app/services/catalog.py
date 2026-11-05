# The business rules for items (product groups), sub-items (products) and their prices.
# Spec: docs/specs/05-items.md. No HTTP here.
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import PriceHistory, Product, ProductGroup, User, now_local
from app.schemas import (
    GroupCreate, GroupUpdate, PriceChangeOut, PriceHistoryOut,
    ProductCreate, ProductOut, ProductUpdate,
)

NAME_TAKEN = "That name is already used"


# ---------- Small helpers ----------


def _commit(db: Session) -> None:
    """Save. If the database refuses (e.g. two people added the same name at the
    same moment), undo everything and answer 409 instead of crashing."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "name_taken", NAME_TAKEN)


def _record_price(db: Session, owner: User, price: int | None, *,
                  group: ProductGroup | None = None, product: Product | None = None) -> None:
    """Add one price_history row. It is only ever added, never edited (rule 2)."""
    db.add(PriceHistory(
        group_id=group.id if group else None,
        product_id=product.id if product else None,
        price=price,
        changed_at=now_local(),
        changed_by=owner.id,
    ))


def get_group(db: Session, group_id: int) -> ProductGroup:
    group = db.get(ProductGroup, group_id)
    if group is None:
        raise AppError(404, "not_found", "Item not found")
    return group


def get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise AppError(404, "not_found", "Sub-item not found")
    return product


def _check_group_name_free(db: Session, name: str, except_id: int | None = None) -> None:
    """Item names are unique, ignoring upper/lower case ("soda" = "Soda")."""
    query = select(ProductGroup.id).where(func.lower(ProductGroup.name) == name.lower())
    if except_id is not None:
        query = query.where(ProductGroup.id != except_id)  # renaming to its own name is fine
    if db.scalar(query) is not None:
        raise AppError(409, "name_taken", NAME_TAKEN)


def _check_product_name_free(db: Session, group_id: int, name: str,
                             except_id: int | None = None) -> None:
    """Sub-item names are unique inside their item only."""
    query = select(Product.id).where(
        Product.group_id == group_id, func.lower(Product.name) == name.lower()
    )
    if except_id is not None:
        query = query.where(Product.id != except_id)
    if db.scalar(query) is not None:
        raise AppError(409, "name_taken", NAME_TAKEN)


# ---------- Items ----------


def list_groups(db: Session, include_stopped: bool) -> list[ProductGroup]:
    query = select(ProductGroup).order_by(ProductGroup.name)
    if not include_stopped:
        query = query.where(ProductGroup.is_active.is_(True))
    return list(db.scalars(query))


def create_group(db: Session, owner: User, request: GroupCreate) -> ProductGroup:
    _check_group_name_free(db, request.name)
    group = ProductGroup(name=request.name, current_price=request.price)
    db.add(group)
    db.flush()  # gives the group its id, needed by the history row
    _record_price(db, owner, request.price, group=group)  # rule 3: the first price too
    _commit(db)
    return group


def update_group(db: Session, group_id: int, request: GroupUpdate) -> ProductGroup:
    group = get_group(db, group_id)
    if request.name is not None:
        _check_group_name_free(db, request.name, except_id=group.id)
        group.name = request.name
    if request.is_active is not None:
        # Stopping an item does not touch its sub-items' own is_active (rule 8),
        # so bringing it back restores them exactly as they were.
        group.is_active = request.is_active
    _commit(db)
    return group


def set_group_price(db: Session, owner: User, group_id: int, price: int) -> PriceChangeOut:
    group = get_group(db, group_id)
    old_price = group.current_price
    if price == old_price:
        return PriceChangeOut(old_price=old_price, new_price=price, changed=False)  # rule 4

    group.current_price = price
    _record_price(db, owner, price, group=group)  # same transaction as the change
    _commit(db)
    return PriceChangeOut(old_price=old_price, new_price=price, changed=True)


def price_history_for_group(db: Session, group_id: int) -> list[PriceHistoryOut]:
    """The item's own price changes AND its sub-items' own-price changes, newest first."""
    group = get_group(db, group_id)
    product_ids = select(Product.id).where(Product.group_id == group.id)
    rows = db.execute(
        select(PriceHistory, User.full_name, Product.name)
        .join(User, PriceHistory.changed_by == User.id)
        .outerjoin(Product, PriceHistory.product_id == Product.id)
        .where(or_(PriceHistory.group_id == group.id, PriceHistory.product_id.in_(product_ids)))
        .order_by(PriceHistory.changed_at.desc(), PriceHistory.id.desc())
    )
    return [
        PriceHistoryOut(
            target="item" if entry.group_id is not None else "sub-item",
            name=group.name if entry.group_id is not None else product_name,
            price=entry.price,
            changed_at=entry.changed_at,
            changed_by=changed_by,
        )
        for entry, changed_by, product_name in rows
    ]


# ---------- Sub-items ----------


def build_product_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        group_id=product.group_id,
        group=product.group.name,
        own_price=product.own_price,
        effective_price=product.effective_price,  # the same property sales uses
        quantity_in_store=product.quantity_in_store,
        min_level=product.min_level,
        stock_status=product.stock_status,
        is_active=product.is_active,
    )


def list_products(db: Session, include_stopped: bool, group_id: int | None) -> list[Product]:
    query = (
        select(Product).join(ProductGroup).order_by(ProductGroup.name, Product.name)
    )
    if not include_stopped:
        # Stopped = the sub-item is stopped OR its item is stopped.
        query = query.where(Product.is_active.is_(True), ProductGroup.is_active.is_(True))
    if group_id is not None:
        query = query.where(Product.group_id == group_id)
    return list(db.scalars(query))


def create_product(db: Session, owner: User, request: ProductCreate) -> Product:
    group = db.get(ProductGroup, request.group_id)
    if group is None:
        raise AppError(422, "unknown_item", "Unknown item", group_id=request.group_id)
    if not group.is_active:
        raise AppError(409, "item_stopped", "This item is stopped. Bring it back first.")
    _check_product_name_free(db, group.id, request.name)

    product = Product(
        group_id=group.id,
        name=request.name,
        own_price=request.own_price,
        min_level=request.min_level,
        quantity_in_store=0,  # rule 7: stock only arrives through deliveries
    )
    db.add(product)
    db.flush()
    if request.own_price is not None:
        _record_price(db, owner, request.own_price, product=product)  # rule 3
    _commit(db)
    return product


def update_product(db: Session, product_id: int, request: ProductUpdate) -> Product:
    product = get_product(db, product_id)
    if request.name is not None:
        _check_product_name_free(db, product.group_id, request.name, except_id=product.id)
        product.name = request.name
    if request.min_level is not None:
        product.min_level = request.min_level
    if request.is_active is not None:
        product.is_active = request.is_active  # stock is kept either way (rule 8)
    _commit(db)
    return product


def set_product_price(db: Session, owner: User, product_id: int,
                      price: int | None) -> PriceChangeOut:
    product = get_product(db, product_id)
    old_price = product.own_price
    if price == old_price:
        return PriceChangeOut(old_price=old_price, new_price=price, changed=False)

    product.own_price = price  # None = use the item price again
    _record_price(db, owner, price, product=product)
    _commit(db)
    return PriceChangeOut(old_price=old_price, new_price=price, changed=True)
