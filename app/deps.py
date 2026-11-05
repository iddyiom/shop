# "Dependencies": small functions FastAPI runs BEFORE an endpoint.
# An endpoint that asks for CurrentUser can only run for a logged-in user.
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.models import User
from app.security import read_token

# Reads the "Authorization: Bearer <token>" header.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise AppError(401, "not_logged_in", "Please log in")

    user_id = read_token(credentials.credentials)
    user = db.get(User, user_id) if user_id is not None else None
    if user is None or not user.is_active:
        raise AppError(401, "not_logged_in", "Please log in")
    if user.is_locked:
        raise AppError(423, "account_locked", "Account locked. Ask the owner to unlock it.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_owner(user: CurrentUser) -> User:
    if not user.is_owner:
        raise AppError(403, "owner_only", "Only the owner can do this")
    return user


OwnerUser = Annotated[User, Depends(require_owner)]
