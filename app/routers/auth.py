# Login and "who am I".
from fastapi import APIRouter
from sqlalchemy import select

from app.config import MAX_LOGIN_ATTEMPTS
from app.deps import CurrentUser, DbSession
from app.errors import AppError
from app.models import User
from app.schemas import LoginRequest, LoginResponse, UserOut
from app.security import create_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

LOCKED_MESSAGE = "Account locked. Ask the owner to unlock it."


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: DbSession):
    user = db.scalar(select(User).where(User.username == body.username))

    if user is None or not user.is_active:
        raise AppError(401, "wrong_credentials", "Wrong username or password")

    # A locked account stays locked, even with the right password.
    if user.is_locked:
        raise AppError(423, "account_locked", LOCKED_MESSAGE)

    if not verify_password(body.password, user.password_hash):
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_LOGIN_ATTEMPTS:
            user.is_locked = True
        db.commit()  # save the count even though we are about to return an error

        if user.is_locked:
            raise AppError(423, "account_locked", LOCKED_MESSAGE)
        remaining = MAX_LOGIN_ATTEMPTS - user.failed_attempts
        raise AppError(
            401,
            "wrong_credentials",
            f"Wrong username or password. {remaining} tries remaining",
            attempts_remaining=remaining,
        )

    # Correct password: reset the counter and hand out a token.
    user.failed_attempts = 0
    db.commit()
    return LoginResponse(access_token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def read_me(user: CurrentUser):
    return user
