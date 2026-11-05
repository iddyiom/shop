# Store balance endpoints (everyone) and the stock history (owner only).
# Adjusting stock is POST /products/{id}/adjustments, in routers/products.py.
from datetime import date
from typing import Literal

from fastapi import APIRouter

from app.deps import CurrentUser, DbSession, OwnerUser
from app.schemas import StockEntryOut, StockLineOut
from app.services import stock

router = APIRouter(tags=["stock"])


@router.get("/stock", response_model=list[StockLineOut])
def list_stock(
    db: DbSession,
    _user: CurrentUser,
    group_id: int | None = None,
    search: str | None = None,
    include_stopped: bool = False,
):
    products = stock.list_stock(db, group_id, search, include_stopped)
    return [stock.build_stock_line(product) for product in products]


@router.get("/stock/low", response_model=list[StockLineOut])
def list_low_stock(db: DbSession, _user: CurrentUser):
    return [stock.build_stock_line(product) for product in stock.list_low_stock(db)]


@router.get("/stock-entries", response_model=list[StockEntryOut])
def list_stock_entries(
    db: DbSession,
    _owner: OwnerUser,
    product_id: int | None = None,
    kind: Literal["correction", "adjustment"] | None = None,
    day: date | None = None,
):
    """Corrections and adjustments, newest first."""
    entries = stock.list_stock_entries(db, product_id, kind, day)
    return [stock.build_stock_entry_out(entry) for entry in entries]
