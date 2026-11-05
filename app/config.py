# Settings for the app. Each one can be changed with an environment variable,
# so the same code runs on a laptop (SQLite) and on a server (PostgreSQL).
import os
import secrets
from datetime import timedelta, timezone
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent

# Where the database lives. Default: a SQLite file in the project folder.
# Later, for example: DEPOT_DATABASE_URL=postgresql+psycopg://user:pass@host/depot
DATABASE_URL = os.environ.get(
    "DEPOT_DATABASE_URL", f"sqlite:///{(PROJECT_DIR / 'depot.db').as_posix()}"
)


def _load_secret_key() -> str:
    """The secret used to sign login tokens. It must never be in Git."""
    key = os.environ.get("DEPOT_SECRET_KEY")
    if key:
        return key
    # On a laptop: make a random key once and keep it in a git-ignored file.
    key_file = PROJECT_DIR / ".secret_key"
    if not key_file.exists():
        key_file.write_text(secrets.token_urlsafe(48))
    return key_file.read_text().strip()


SECRET_KEY = _load_secret_key()
TOKEN_ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(hours=12)  # one working day

MAX_LOGIN_ATTEMPTS = 3

# Tanzania is UTC+3 all year (no daylight saving), so a fixed offset is safe.
DEPOT_TIMEZONE = timezone(timedelta(hours=3), "EAT")
