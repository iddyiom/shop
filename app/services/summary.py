# Today's numbers for the home screen. Spec: docs/specs/08-summary.md. Read-only.
from datetime import datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Delivery, Sale, SaleItem, now_local
from app.schemas import SummaryOut, SummaryOwnerOut
from app.services.stock import list_low_stock


def today_summary(db: Session, for_owner: bool) -> SummaryOut:
    # Rule 1: the depot's day (East Africa Time), 00:00 up to (not including) 00:00 tomorrow.
    today = now_local().date()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    is_today = (Sale.sold_at >= start) & (Sale.sold_at < end)

    # Rule 7: the database adds up. coalesce(..., 0): SUM of no rows is NULL, we want 0.
    items_sold = db.scalar(
        select(func.coalesce(func.sum(SaleItem.quantity), 0)).join(Sale).where(is_today)
    )
    # Rule 5: the date on the paperwork, not when it was typed in.
    last_restock = db.scalar(select(func.max(Delivery.delivered_at)))
    # Rule 4: the very same list as GET /stock/low, so the numbers always agree.
    low_stock_count = len(list_low_stock(db))

    numbers = {
        "date": today,
        "items_sold": items_sold,
        "low_stock_count": low_stock_count,
        "last_restock": last_restock,
    }
    if not for_owner:
        return SummaryOut(**numbers)  # rule 6: no money for shopkeepers

    sales_total = db.scalar(select(func.coalesce(func.sum(Sale.total), 0)).where(is_today))
    return SummaryOwnerOut(**numbers, sales_total=sales_total)
