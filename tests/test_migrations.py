# Tests for the Alembic migrations. Spec: docs/specs/09-migrations.md, section 7.
# Each test builds a database from the migrations in a temporary file (never depot.db).
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db, make_engine
from app.main import app
from app.models import ROLE_OWNER, User
from app.security import hash_password

PROJECT_DIR = Path(__file__).resolve().parent.parent
TABLES = {
    "users", "product_groups", "products", "price_history", "deliveries",
    "delivery_items", "stock_entries", "sales", "sale_items",
}


@pytest.fixture
def db_url(tmp_path):
    """The address of an empty SQLite file that exists only for this test."""
    return f"sqlite:///{(tmp_path / 'migrated.db').as_posix()}"


def alembic_config(url: str) -> Config:
    """The same settings as the `alembic` command, pointed at the test database."""
    config = Config(str(PROJECT_DIR / "alembic.ini"))
    config.cmd_opts = type("Options", (), {"x": [f"url={url}"]})()  # same as: alembic -x url=...
    return config


def upgrade(url: str) -> None:
    command.upgrade(alembic_config(url), "head")


def table_names(url: str) -> set[str]:
    engine = create_engine(url)
    names = set(inspect(engine).get_table_names())
    engine.dispose()
    return names


def test_upgrade_creates_all_tables(db_url):
    upgrade(db_url)
    assert table_names(db_url) == TABLES | {"alembic_version"}


def test_migrated_database_matches_models(db_url):
    """If someone changes app/models.py and forgets the migration, this fails."""
    upgrade(db_url)
    engine = create_engine(db_url)
    with engine.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    engine.dispose()
    assert differences == []


def test_migrated_database_enforces_check_constraints(db_url):
    """Invariant 1 must hold in the real database, not only in the models."""
    upgrade(db_url)
    engine = create_engine(db_url)
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO product_groups (id, name, current_price, is_active) VALUES (1, 'Soda', 1000, 1)"
        ))
    with pytest.raises(IntegrityError, match="ck_products_stock"):
        with engine.begin() as connection:
            connection.execute(text(
                "INSERT INTO products (group_id, name, quantity_in_store, min_level, is_active)"
                " VALUES (1, 'Fanta', -1, 0, 1)"
            ))
    engine.dispose()


def test_downgrade_removes_tables_and_upgrade_works_again(db_url):
    upgrade(db_url)
    command.downgrade(alembic_config(db_url), "base")
    assert table_names(db_url) & TABLES == set()  # every app table gone
    upgrade(db_url)
    assert TABLES <= table_names(db_url)


def test_app_works_on_a_migrated_database(db_url):
    upgrade(db_url)
    engine = make_engine(db_url)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with session_factory() as db:
        db.add(User(full_name="Depot Owner", username="owner",
                    password_hash=hash_password("test-pass-123"), role=ROLE_OWNER))
        db.commit()

    def get_migrated_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = get_migrated_db
    try:
        client = TestClient(app)
        login = client.post("/auth/login", json={"username": "owner", "password": "test-pass-123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        created = client.post("/groups", json={"name": "Soda", "price": 1000}, headers=headers)
        assert created.status_code == 201
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
