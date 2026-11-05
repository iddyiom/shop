# Items (product groups) endpoints. Everyone can list; only the owner changes anything.
from fastapi import APIRouter

from app.deps import CurrentUser, DbSession, OwnerUser
from app.schemas import GroupCreate, GroupOut, GroupPriceSet, GroupUpdate, PriceChangeOut, PriceHistoryOut
from app.services import catalog

router = APIRouter(prefix="/groups", tags=["items"])


@router.get("", response_model=list[GroupOut])
def list_groups(db: DbSession, _user: CurrentUser, include_stopped: bool = False):
    return catalog.list_groups(db, include_stopped)


@router.post("", response_model=GroupOut, status_code=201)
def create_group(body: GroupCreate, db: DbSession, owner: OwnerUser):
    return catalog.create_group(db, owner, body)


@router.patch("/{group_id}", response_model=GroupOut)
def update_group(group_id: int, body: GroupUpdate, db: DbSession, _owner: OwnerUser):
    return catalog.update_group(db, group_id, body)


@router.put("/{group_id}/price", response_model=PriceChangeOut)
def set_group_price(group_id: int, body: GroupPriceSet, db: DbSession, owner: OwnerUser):
    return catalog.set_group_price(db, owner, group_id, body.price)


@router.get("/{group_id}/price-history", response_model=list[PriceHistoryOut])
def price_history(group_id: int, db: DbSession, _owner: OwnerUser):
    return catalog.price_history_for_group(db, group_id)
