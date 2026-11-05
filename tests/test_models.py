# Tests that the database itself protects the most important rules.
import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Product


def test_effective_price_uses_own_price_or_group_price(products):
    assert products["fanta"].effective_price == 1000  # no own price -> Soda price
    assert products["water"].effective_price == 1500  # own price wins


def test_stock_status(products, db):
    fanta = products["fanta"]
    fanta.min_level = 5
    assert fanta.stock_status == "LOW"  # 5 <= 5
    assert products["coca"].stock_status == "OUT"
    assert products["chocolate"].stock_status == "OK"


def test_database_refuses_negative_stock(products, db):
    fanta = db.get(Product, products["fanta"].id)
    fanta.quantity_in_store = -1
    with pytest.raises(IntegrityError):
        db.commit()
