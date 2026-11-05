# Managing staff accounts. Owner only.
from fastapi import APIRouter
from sqlalchemy import select

from app.deps import DbSession, OwnerUser
from app.errors import AppError
from app.models import User
from app.schemas import UserCreate, UserOut
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: DbSession, _owner: OwnerUser):
    if db.scalar(select(User).where(User.username == body.username)):
        raise AppError(409, "username_taken", "That username is already used")

    user = User(
        full_name=body.full_name,
        username=body.username,
        password_hash=hash_password(body.password),  # store the hash, never the password
        role=body.role,
    )
    db.add(user)
    db.commit()
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: DbSession, _owner: OwnerUser):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("/{user_id}/unlock", response_model=UserOut)
def unlock_user(user_id: int, db: DbSession, _owner: OwnerUser):
    user = db.get(User, user_id)
    if user is None:
        raise AppError(404, "not_found", "User not found")
    user.is_locked = False
    user.failed_attempts = 0
    db.commit()
    return user
