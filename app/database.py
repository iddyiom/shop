# The connection to the database, and the "session" each request uses.
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL


def make_engine(url: str, **options):
    """Create an engine. SQLite needs two extra settings; PostgreSQL needs none."""
    is_sqlite = url.startswith("sqlite")
    if is_sqlite:
        # FastAPI may use the connection from different threads.
        options.setdefault("connect_args", {"check_same_thread": False})
    engine = create_engine(url, **options)

    if is_sqlite:
        # SQLite ignores foreign keys unless we turn them on for every connection.
        @event.listens_for(engine, "connect")
        def _turn_on_foreign_keys(dbapi_connection, _record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

    return engine


engine = make_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Every table class in models.py inherits from this."""


def get_db():
    """Give one database session to one request, and always close it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
