# Deliveries endpoints. Owner and shopkeeper can both receive stock.
# Only the owner sees buying prices and corrects a delivery.
from datetime import date

from fastapi import APIRouter

from app.deps import CurrentUser, DbSession, OwnerUser
from app.schemas import CorrectionCreate, CorrectionOut, DeliveryCreate, DeliveryOut, DeliveryOwnerOut
from app.services import deliveries

router = APIRouter(prefix="/deliveries", tags=["deliveries"])

# The owner gets DeliveryOwnerOut (with buying prices), a shopkeeper gets DeliveryOut.
# Listing both lets FastAPI send whichever one the service built.
DeliveryResponse = DeliveryOwnerOut | DeliveryOut


@router.post("", response_model=DeliveryResponse, status_code=201)
def create_delivery(body: DeliveryCreate, db: DbSession, user: CurrentUser):
    delivery = deliveries.record_delivery(db, user, body)
    return deliveries.build_delivery_out(delivery, for_owner=user.is_owner)


@router.get("", response_model=list[DeliveryResponse])
def list_deliveries(db: DbSession, user: CurrentUser, day: date | None = None):
    """All deliveries, newest first. ?day=2026-11-05 shows one day only."""
    return [
        deliveries.build_delivery_out(delivery, for_owner=user.is_owner)
        for delivery in deliveries.list_deliveries(db, day)
    ]


@router.get("/{delivery_id}", response_model=DeliveryResponse)
def read_delivery(delivery_id: int, db: DbSession, user: CurrentUser):
    delivery = deliveries.get_delivery(db, delivery_id)
    return deliveries.build_delivery_out(delivery, for_owner=user.is_owner)


@router.post("/{delivery_id}/corrections", response_model=CorrectionOut, status_code=201)
def add_correction(delivery_id: int, body: CorrectionCreate, db: DbSession, owner: OwnerUser):
    return deliveries.add_correction(db, owner, delivery_id, body)
