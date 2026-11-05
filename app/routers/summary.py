# The home screen's numbers. Everyone sees them; only the owner sees money.
from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.schemas import SummaryOut, SummaryOwnerOut
from app.services.summary import today_summary

router = APIRouter(prefix="/summary", tags=["summary"])


# The owner gets SummaryOwnerOut (with sales_total), a shopkeeper gets SummaryOut.
@router.get("/today", response_model=SummaryOwnerOut | SummaryOut)
def read_today(db: DbSession, user: CurrentUser):
    return today_summary(db, for_owner=user.is_owner)
