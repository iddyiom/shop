# Sub-items (products) endpoints. Everyone can list; only the owner changes anything.
# Stock only changes through sales, deliveries and the adjustments endpoint at the bottom.
from fastapi import APIRouter

from app.deps import CurrentUser, DbSession, OwnerUser
from app.schemas import (
    AdjustmentCreate, AdjustmentOut, PriceChangeOut, ProductCreate, ProductOut, ProductPriceSet,
    ProductUpdate,
)
from app.services import catalog, stock

router = APIRouter(prefix="/products", tags=["sub-items"])


@router.get("", response_model=list[ProductOut])
def list_products(
    db: DbSession, _user: CurrentUser, include_stopped: bool = False, group_id: int | None = None
):
    products = catalog.list_products(db, include_stopped, group_id)
    return [catalog.build_product_out(product) for product in products]


@router.post("", response_model=ProductOut, status_code=201)
def create_product(body: ProductCreate, db: DbSession, owner: OwnerUser):
    return catalog.build_product_out(catalog.create_product(db, owner, body))


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, db: DbSession, _owner: OwnerUser):
    return catalog.build_product_out(catalog.update_product(db, product_id, body))


@router.put("/{product_id}/price", response_model=PriceChangeOut)
def set_product_price(product_id: int, body: ProductPriceSet, db: DbSession, owner: OwnerUser):
    return catalog.set_product_price(db, owner, product_id, body.price)


@router.post("/{product_id}/adjustments", response_model=AdjustmentOut, status_code=201)
def add_adjustment(product_id: int, body: AdjustmentCreate, db: DbSession, owner: OwnerUser):
    """Add or remove stock for damaged, expired, lost or miscounted goods. Owner only."""
    return stock.add_adjustment(db, owner, product_id, body)
