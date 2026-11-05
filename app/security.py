# Password hashing and login tokens.
from datetime import datetime, timezone

import bcrypt
import jwt

from app.config import SECRET_KEY, TOKEN_ALGORITHM, TOKEN_LIFETIME

# bcrypt only looks at the first 72 bytes of a password.
MAX_PASSWORD_BYTES = 72


def hash_password(plain_password: str) -> str:
    """Turn a password into a one-way hash. The salt makes every hash different."""
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Hash the typed password the same way and compare."""
    password_bytes = plain_password.encode()
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(password_bytes, password_hash.encode())


def create_token(user_id: int) -> str:
    """A signed token that says "this is user N" until it expires."""
    expires_at = datetime.now(timezone.utc) + TOKEN_LIFETIME
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, SECRET_KEY, algorithm=TOKEN_ALGORITHM)


def read_token(token: str) -> int | None:
    """Return the user id inside a valid token, or None if it is fake or expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[TOKEN_ALGORITHM])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
