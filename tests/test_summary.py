# Tests for the home summary. Spec: docs/specs/08-summary.md, section 7.
# Example data (conftest.py): Fanta 5 and Coca-Cola 0 (Soda, 1000 each); Chocolate 10 (500);
# Water kubwa 4 (own price 1500). All min_level 0, so only Coca-Cola starts as low (OUT).
from datetime import timedelta

from app.models import Delivery, Sale, SaleItem, now_local


def sell(client, headers, items):
    return client.post("/sales", json={"payment_method": "cash", "items": items}, headers=headers)


def summary(client, headers):
    response = client.get("/summary/today", headers=headers)
    assert response.status_code == 200
    return response.json()


def test_owner_sees_sales_total_and_items_sold_today(client, owner_headers, shopkeeper_headers, products):
    sell(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 2}])  # 2000
    sell(client, owner_headers, [{"product_id": products["water"].id, "quantity": 1}])  # 1500

    numbers = summary(client, owner_headers)
    assert numbers["date"] == now_local().date().isoformat()
    assert numbers["sales_total"] == 3500
    assert numbers["items_sold"] == 3


def test_shopkeeper_never_sees_sales_total(client, shopkeeper_headers, products):
    sell(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 2}])
    numbers = summary(client, shopkeeper_headers)
    assert numbers["items_sold"] == 2  # the rest is there...
    assert "sales_total" not in numbers  # ...but no money
    assert set(numbers) == {"date", "items_sold", "low_stock_count", "last_restock"}


def test_items_sold_counts_units_not_sales(client, shopkeeper_headers, owner_headers, products):
    sell(client, shopkeeper_headers, [
        {"product_id": products["fanta"].id, "quantity": 2},
        {"product_id": products["chocolate"].id, "quantity": 1},
    ])
    assert summary(client, owner_headers)["items_sold"] == 3  # one sale, three units


def test_yesterdays_sales_are_not_counted(client, owner_headers, products, shopkeeper, db):
    yesterday = now_local() - timedelta(days=1)
    old_sale = Sale(sold_at=yesterday, sold_by=shopkeeper.id, payment_method="cash", total=5000)
    old_sale.items.append(
        SaleItem(product_id=products["fanta"].id, quantity=5, unit_price=1000, line_total=5000)
    )
    db.add(old_sale)
    db.commit()

    numbers = summary(client, owner_headers)
    assert numbers["sales_total"] == 0
    assert numbers["items_sold"] == 0


def test_low_stock_count_matches_low_stock_list(client, owner_headers, products, db):
    products["water"].min_level = 4  # 4 in store -> LOW
    db.commit()

    low_list = client.get("/stock/low", headers=owner_headers).json()
    assert summary(client, owner_headers)["low_stock_count"] == len(low_list) == 2  # Coca-Cola OUT, Water LOW

    client.patch(f"/products/{products['coca'].id}", json={"is_active": False}, headers=owner_headers)
    low_list = client.get("/stock/low", headers=owner_headers).json()
    assert summary(client, owner_headers)["low_stock_count"] == len(low_list) == 1


def test_last_restock_is_latest_delivery_date_not_entry_time(client, owner_headers, products):
    today = now_local().date()
    line = [{"product_id": products["fanta"].id, "quantity": 1}]
    three_days_ago = (today - timedelta(days=3)).isoformat()
    week_ago = (today - timedelta(days=7)).isoformat()

    client.post("/deliveries", json={"items": line, "delivered_at": three_days_ago}, headers=owner_headers)
    # Typed in AFTER the other one, but its paperwork date is older.
    client.post("/deliveries", json={"items": line, "delivered_at": week_ago}, headers=owner_headers)

    assert summary(client, owner_headers)["last_restock"] == three_days_ago


def test_empty_day_shows_zeros_and_no_restock(client, owner_headers, shopkeeper_headers, products, db):
    assert db.query(Delivery).count() == 0
    numbers = summary(client, owner_headers)
    assert (numbers["items_sold"], numbers["sales_total"], numbers["last_restock"]) == (0, 0, None)
    assert numbers["low_stock_count"] == 1  # Coca-Cola is OUT
    assert summary(client, shopkeeper_headers)["last_restock"] is None


def test_must_be_logged_in_to_see_summary(client, products):
    assert client.get("/summary/today").status_code == 401
