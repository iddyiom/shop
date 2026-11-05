# Shared test setup ("fixtures"). pytest finds this file automatically.
# Every test gets a fresh, empty in-memory database, so tests never touch depot.db.
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db, make_engine
from app.main import app
from app.models import ROLE_OWNER, ROLE_SHOPKEEPER, Product, ProductGroup, User
from app.security import create_token, hash_password

TEST_PASSWORD = "test-pass-123"


@pytest.fixture
def session_factory():
    # "sqlite://" = a database in memory. StaticPool = share one connection.
    engine = make_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def db(session_factory):
    session = session_factory()
    yield session
    session.close()


@pytest.fixture
def client(session_factory):
    """A test client whose requests use the test database instead of depot.db."""

    def get_test_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = get_test_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _add_user(db, username, role, full_name):
    user = User(
        full_name=full_name,
        username=username,
        password_hash=hash_password(TEST_PASSWORD),
        role=role,
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def owner(db):
    return _add_user(db, "owner", ROLE_OWNER, "Depot Owner")


@pytest.fixture
def shopkeeper(db):
    return _add_user(db, "shopkeeper", ROLE_SHOPKEEPER, "Shop Keeper")


@pytest.fixture
def owner_headers(owner):
    return {"Authorization": f"Bearer {create_token(owner.id)}"}


@pytest.fixture
def shopkeeper_headers(shopkeeper):
    return {"Authorization": f"Bearer {create_token(shopkeeper.id)}"}


@pytest.fixture
def products(db):
    """Example data from docs/database-design.md, with some stock."""
    soda = ProductGroup(name="Soda", current_price=1000)
    biscuit = ProductGroup(name="Biscuit", current_price=500)
    water = ProductGroup(name="Water kubwa", current_price=1000)
    db.add_all([soda, biscuit, water])
    db.flush()  # gives the groups their ids
    items = {
        "fanta": Product(group_id=soda.id, name="Fanta", quantity_in_store=5),
        "coca": Product(group_id=soda.id, name="Coca-Cola", quantity_in_store=0),
        "chocolate": Product(group_id=biscuit.id, name="Chocolate", quantity_in_store=10),
        "water": Product(
            group_id=water.id, name="Water kubwa", own_price=1500, quantity_in_store=4
        ),
    }
    db.add_all(items.values())
    db.commit()
    return items
