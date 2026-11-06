# Business rules for editing staff accounts (rename, deactivate, reactivate).
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import User
from app.schemas import UserUpdate


def update_user(db: Session, owner: User, user_id: int, request: UserUpdate) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise AppError(404, "not_found", "User not found")

    # Check first, then change: refuse before touching anything.
    # Deactivating yourself could leave the depot with no one able to log in.
    if request.is_active is False and user.id == owner.id:
        raise AppError(409, "cannot_deactivate_self", "You cannot deactivate your own account")

    if request.full_name is not None:
        user.full_name = request.full_name
    if request.is_active is not None:
        # Never delete: the row stays, so old sales still show who made them.
        # Reactivating does not unlock; unlocking is its own action.
        user.is_active = request.is_active

    db.commit()
    return user
