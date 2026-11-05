# Tests for selling. Most come straight from the acceptance criteria in
# docs/requirements.md (section 10).
from app.models import Product, ProductGroup, Sale


def sell(client, headers, items, payment_method="cash"):
    return client.post(
        "/sales", json={"payment_method": payment_method, "items": items}, headers=headers
    )


def stock_of(db, product):
    db.expire_all()  # forget cached values, read fresh from the database
    return db.get(Product, product.id).quantity_in_store


def test_line_total_is_quantity_times_price(client, shopkeeper_headers, products):
    response = sell(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 2}])
    assert response.status_code == 201
    line = response.json()["items"][0]
    assert line["unit_price"] == 1000
    assert line["line_total"] == 2000


def test_bill_total_is_sum_of_lines(client, shopkeeper_headers, products):
    items = [
        {"product_id": products["fanta"].id, "quantity": 2},  # 2 x 1000
        {"product_id": products["chocolate"].id, "quantity": 1},  # 1 x 500
        {"product_id": products["water"].id, "quantity": 1},  # 1 x 1500 (own price)
    ]
    receipt = sell(client, shopkeeper_headers, items).json()
    assert receipt["total"] == 4000
    assert receipt["sold_by"] == "Shop Keeper"


def test_sub_item_own_price_is_used(client, shopkeeper_headers, products):
    receipt = sell(client, shopkeeper_headers, [{"product_id": products["water"].id, "quantity": 1}]).json()
    assert receipt["items"][0]["unit_price"] == 1500  # not the group's 1000


def test_server_ignores_prices_sent_by_the_screen(client, shopkeeper_headers, products):
    cheat = [{"product_id": products["fanta"].id, "quantity": 1, "unit_price": 1}]
    response = client.post(
        "/sales",
        json={"payment_method": "cash", "items": cheat, "total": 1},
        headers=shopkeeper_headers,
    )
    assert response.json()["total"] == 1000


def test_stock_zero_is_not_available(client, shopkeeper_headers, products):
    response = sell(client, shopkeeper_headers, [{"product_id": products["coca"].id, "quantity": 1}])
    assert response.status_code == 409
    assert response.json()["message"] == "Item not available"


def test_more_than_stock_is_item_over(client, shopkeeper_headers, products):
    response = sell(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 6}])
    assert response.status_code == 409
    assert response.json()["message"] == "Item over: only 5 in store"
    assert response.json()["available"] == 5


def test_sale_reduces_stock(client, shopkeeper_headers, products, db):
    sell(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 2}])
    assert stock_of(db, products["fanta"]) == 3


def test_sale_is_all_or_nothing(client, shopkeeper_headers, products, db):
    items = [
        {"product_id": products["fanta"].id, "quantity": 2},  # fine
        {"product_id": products["chocolate"].id, "quantity": 99},  # too many
    ]
    assert sell(client, shopkeeper_headers, items).status_code == 409
    assert stock_of(db, products["fanta"]) == 5  # untouched
    assert db.query(Sale).count() == 0  # no half-saved sale


def test_same_product_twice_is_added_together(client, shopkeeper_headers, products, db):
    items = [
        {"product_id": products["fanta"].id, "quantity": 3},
        {"product_id": products["fanta"].id, "quantity": 3},  # 6 in total, only 5 in store
    ]
    response = sell(client, shopkeeper_headers, items)
    assert response.json()["message"] == "Item over: only 5 in store"


def test_old_receipt_keeps_old_price(client, shopkeeper_headers, products, db):
    receipt = sell(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 1}]).json()

    soda = db.query(ProductGroup).filter_by(name="Soda").one()
    soda.current_price = 1200  # the price goes up later
    db.commit()

    again = client.get(f"/sales/{receipt['id']}", headers=shopkeeper_headers).json()
    assert again["items"][0]["unit_price"] == 1000


def test_stopped_sub_item_cannot_be_sold(client, shopkeeper_headers, products, db):
    fanta = db.get(Product, products["fanta"].id)
    fanta.is_active = False
    db.commit()
    response = sell(client, shopkeeper_headers, [{"product_id": fanta.id, "quantity": 1}])
    assert response.json()["message"] == "Item not available"
    assert stock_of(db, fanta) == 5  # stock is kept, ready for "Bring back"


def test_owner_can_sell_and_receipt_shows_owner(client, owner_headers, products):
    receipt = sell(client, owner_headers, [{"product_id": products["fanta"].id, "quantity": 1}]).json()
    assert receipt["sold_by"] == "Depot Owner"


def test_bad_input_is_rejected(client, shopkeeper_headers, products):
    fanta_id = products["fanta"].id
    assert sell(client, shopkeeper_headers, [{"product_id": fanta_id, "quantity": 0}]).status_code == 422
    assert sell(client, shopkeeper_headers, []).status_code == 422
    assert sell(client, shopkeeper_headers, [{"product_id": 999, "quantity": 1}]).status_code == 422
    wrong_payment = sell(client, shopkeeper_headers, [{"product_id": fanta_id, "quantity": 1}], "credit")
    assert wrong_payment.status_code == 422


def test_must_be_logged_in_to_sell(client, products):
    response = client.post(
        "/sales",
        json={"payment_method": "cash", "items": [{"product_id": products["fanta"].id, "quantity": 1}]},
    )
    assert response.status_code == 401


def test_list_sales_and_missing_receipt(client, shopkeeper_headers, products):
    sell(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 1}])
    sell(client, shopkeeper_headers, [{"product_id": products["chocolate"].id, "quantity": 1}])

    all_sales = client.get("/sales", headers=shopkeeper_headers).json()
    assert len(all_sales) == 2
    assert all_sales[0]["items"][0]["product"] == "Chocolate"  # newest first

    other_day = client.get("/sales?day=2000-01-01", headers=shopkeeper_headers).json()
    assert other_day == []

    assert client.get("/sales/999", headers=shopkeeper_headers).status_code == 404
