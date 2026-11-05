# Sales endpoints. Owner and shopkeeper can both sell.
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import AppError
from app.models import Sale
from app.schemas import Receipt, SaleCreate
from app.services.sales import build_receipt, record_sale

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=Receipt, status_code=201)
def create_sale(body: SaleCreate, db: DbSession, user: CurrentUser):
    sale = record_sale(db, user, body)
    return build_receipt(sale)  # the response IS the receipt


@router.get("", response_model=list[Receipt])
def list_sales(db: DbSession, _user: CurrentUser, day: date | None = None):
    """All sales, newest first. ?day=2026-11-04 shows one day only."""
    query = select(Sale).order_by(Sale.sold_at.desc(), Sale.id.desc())
    if day is not None:
        start = datetime.combine(day, time.min)
        query = query.where(Sale.sold_at >= start, Sale.sold_at < start + timedelta(days=1))
    return [build_receipt(sale) for sale in db.scalars(query)]


@router.get("/{sale_id}", response_model=Receipt)
def read_sale(sale_id: int, db: DbSession, _user: CurrentUser):
    sale = db.get(Sale, sale_id)
    if sale is None:
        raise AppError(404, "not_found", "Sale not found")
    return build_receipt(sale)
