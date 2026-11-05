# Tests for deliveries and corrections. Spec: docs/specs/06-deliveries.md, section 7.
from datetime import timedelta

from sqlalchemy import func, select

from app.models import Delivery, Product, StockEntry, now_local


def deliver(client, headers, items, **extra):
    return client.post("/deliveries", json={"items": items, **extra}, headers=headers)


def stock_of(db, product):
    db.expire_all()  # read fresh from the database
    return db.get(Product, product.id).quantity_in_store


def count(db, table):
    db.expire_all()
    return db.scalar(select(func.count()).select_from(table))


def has_buying_price_anywhere(data) -> bool:
    """True if the key 'buying_price' appears anywhere in the JSON."""
    if isinstance(data, dict):
        return "buying_price" in data or any(has_buying_price_anywhere(v) for v in data.values())
    if isinstance(data, list):
        return any(has_buying_price_anywhere(v) for v in data)
    return False


# ---------- Recording a delivery ----------


def test_delivery_increases_stock_for_every_line(client, owner_headers, products, db):
    response = deliver(client, owner_headers, [
        {"product_id": products["fanta"].id, "quantity": 24},  # 5 -> 29
        {"product_id": products["coca"].id, "quantity": 12},  # 0 -> 12
    ])
    assert response.status_code == 201
    assert stock_of(db, products["fanta"]) == 29
    assert stock_of(db, products["coca"]) == 12


def test_shopkeeper_records_delivery_and_is_shown_as_receiver(client, shopkeeper_headers, products):
    response = deliver(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 6}])
    assert response.status_code == 201
    assert response.json()["received_by"] == "Shop Keeper"
    assert response.json()["items"][0]["product"] == "Fanta"


def test_delivery_is_all_or_nothing(client, owner_headers, products, db):
    products["chocolate"].is_active = False  # the 2nd line will be refused
    db.commit()
    response = deliver(client, owner_headers, [
        {"product_id": products["fanta"].id, "quantity": 24},
        {"product_id": products["chocolate"].id, "quantity": 10},
    ])
    assert response.status_code == 409
    assert stock_of(db, products["fanta"]) == 5  # not raised
    assert count(db, Delivery) == 0  # nothing saved


def test_unknown_product_is_rejected(client, owner_headers, products):
    response = deliver(client, owner_headers, [{"product_id": 999, "quantity": 1}])
    assert response.status_code == 422
    assert response.json()["error"] == "unknown_product"


def test_stopped_sub_item_or_item_cannot_be_received(client, owner_headers, products):
    fanta = [{"product_id": products["fanta"].id, "quantity": 1}]

    client.patch(f"/products/{products['fanta'].id}", json={"is_active": False}, headers=owner_headers)
    assert deliver(client, owner_headers, fanta).json()["error"] == "item_stopped"

    client.patch(f"/products/{products['fanta'].id}", json={"is_active": True}, headers=owner_headers)
    client.patch(f"/groups/{products['fanta'].group_id}", json={"is_active": False}, headers=owner_headers)
    assert deliver(client, owner_headers, fanta).json()["error"] == "item_stopped"


def test_quantity_zero_or_negative_is_rejected(client, owner_headers, products):
    for quantity in (0, -5):
        response = deliver(client, owner_headers, [{"product_id": products["fanta"].id, "quantity": quantity}])
        assert response.status_code == 422
    assert deliver(client, owner_headers, []).status_code == 422  # no lines at all


def test_same_sub_item_twice_adds_both_lines(client, owner_headers, products, db):
    response = deliver(client, owner_headers, [
        {"product_id": products["fanta"].id, "quantity": 10, "buying_price": 800},
        {"product_id": products["fanta"].id, "quantity": 5, "buying_price": 850},
    ])
    assert [(i["quantity"], i["buying_price"]) for i in response.json()["items"]] == [(10, 800), (5, 850)]
    assert stock_of(db, products["fanta"]) == 20  # 5 + 10 + 5


def test_date_defaults_to_today_past_allowed_future_refused(client, owner_headers, products):
    line = [{"product_id": products["fanta"].id, "quantity": 1}]
    today = now_local().date()

    assert deliver(client, owner_headers, line).json()["delivered_at"] == today.isoformat()
    yesterday = (today - timedelta(days=1)).isoformat()
    assert deliver(client, owner_headers, line, delivered_at=yesterday).json()["delivered_at"] == yesterday
    tomorrow = (today + timedelta(days=1)).isoformat()
    response = deliver(client, owner_headers, line, delivered_at=tomorrow)
    assert response.status_code == 422
    assert response.json()["error"] == "future_date"


# ---------- Buying prices: owner only (invariant 8) ----------


def test_owner_records_buying_price(client, owner_headers, products):
    created = deliver(client, owner_headers, [
        {"product_id": products["fanta"].id, "quantity": 24, "buying_price": 800},
        {"product_id": products["coca"].id, "quantity": 6},
    ]).json()
    assert [i["buying_price"] for i in created["items"]] == [800, None]

    again = client.get(f"/deliveries/{created['id']}", headers=owner_headers).json()
    assert again["items"][0]["buying_price"] == 800


def test_shopkeeper_cannot_send_buying_price(client, shopkeeper_headers, products, db):
    response = deliver(client, shopkeeper_headers, [
        {"product_id": products["fanta"].id, "quantity": 24, "buying_price": 800},
    ])
    assert response.status_code == 403
    assert response.json()["error"] == "owner_only_field"
    assert stock_of(db, products["fanta"]) == 5
    assert count(db, Delivery) == 0


def test_shopkeeper_never_sees_buying_price(client, owner_headers, shopkeeper_headers, products):
    created = deliver(client, owner_headers, [
        {"product_id": products["fanta"].id, "quantity": 24, "buying_price": 800},
    ]).json()

    one = client.get(f"/deliveries/{created['id']}", headers=shopkeeper_headers).json()
    many = client.get("/deliveries", headers=shopkeeper_headers).json()
    own = deliver(client, shopkeeper_headers, [{"product_id": products["fanta"].id, "quantity": 1}]).json()
    assert one["items"][0]["quantity"] == 24  # the delivery is there...
    assert not has_buying_price_anywhere(one)  # ...but not its buying price
    assert not has_buying_price_anywhere(many)
    assert not has_buying_price_anywhere(own)


# ---------- Reading deliveries ----------


def test_list_deliveries_newest_first_and_by_day(client, owner_headers, products):
    line = [{"product_id": products["fanta"].id, "quantity": 1}]
    today = now_local().date()
    old = (today - timedelta(days=3)).isoformat()
    deliver(client, owner_headers, line, delivered_at=old, note="Old truck")
    deliver(client, owner_headers, line, note="Today truck")

    notes = [d["note"] for d in client.get("/deliveries", headers=owner_headers).json()]
    assert notes == ["Today truck", "Old truck"]
    one_day = client.get(f"/deliveries?day={old}", headers=owner_headers).json()
    assert [d["note"] for d in one_day] == ["Old truck"]


def test_unknown_delivery_is_404(client, owner_headers, products):
    assert client.get("/deliveries/999", headers=owner_headers).status_code == 404
    correction = {"product_id": products["fanta"].id, "quantity_change": -1, "reason": "x"}
    assert client.post("/deliveries/999/corrections", json=correction, headers=owner_headers).status_code == 404


def test_must_be_logged_in(client, products):
    assert client.get("/deliveries").status_code == 401


# ---------- Corrections ----------


def make_delivery(client, owner_headers, products, quantity=24):
    """Deliver Fanta (stock 5 -> 5 + quantity) and return the delivery id."""
    return deliver(client, owner_headers, [{"product_id": products["fanta"].id, "quantity": quantity}]).json()["id"]


def correct(client, headers, delivery_id, product_id, change, reason="Counted again"):
    return client.post(
        f"/deliveries/{delivery_id}/corrections",
        json={"product_id": product_id, "quantity_change": change, "reason": reason},
        headers=headers,
    )


def test_correction_changes_stock_and_keeps_original_lines(client, owner_headers, products, db):
    delivery_id = make_delivery(client, owner_headers, products)  # Fanta 5 -> 29
    response = correct(client, owner_headers, delivery_id, products["fanta"].id, -2)
    assert response.status_code == 201
    body = response.json()
    assert (body["before"], body["after"], body["quantity_change"]) == (29, 27, -2)
    assert body["by"] == "Depot Owner"
    assert stock_of(db, products["fanta"]) == 27

    # The original line still says 24: history is never edited.
    detail = client.get(f"/deliveries/{delivery_id}", headers=owner_headers).json()
    assert detail["items"][0]["quantity"] == 24
    entry = db.scalar(select(StockEntry))
    assert (entry.kind, entry.delivery_id) == ("correction", delivery_id)


def test_correction_needs_a_reason(client, owner_headers, products):
    delivery_id = make_delivery(client, owner_headers, products)
    for reason in ("", "   "):
        assert correct(client, owner_headers, delivery_id, products["fanta"].id, -1, reason).status_code == 422
    assert correct(client, owner_headers, delivery_id, products["fanta"].id, 0).status_code == 422


def test_correction_product_must_be_on_the_delivery(client, owner_headers, products):
    delivery_id = make_delivery(client, owner_headers, products)
    response = correct(client, owner_headers, delivery_id, products["chocolate"].id, 1)
    assert response.status_code == 422
    assert response.json()["error"] == "not_on_delivery"


def test_correction_cannot_take_more_than_was_delivered(client, owner_headers, products, db):
    delivery_id = make_delivery(client, owner_headers, products, quantity=10)  # Fanta 5 -> 15
    assert correct(client, owner_headers, delivery_id, products["fanta"].id, -4).status_code == 201  # 6 left
    response = correct(client, owner_headers, delivery_id, products["fanta"].id, -7)
    assert response.status_code == 409
    assert response.json()["error"] == "correction_too_big"
    assert response.json()["available"] == 6
    assert stock_of(db, products["fanta"]) == 11  # only the first correction happened


def test_correction_cannot_push_stock_below_zero(client, owner_headers, shopkeeper_headers, products, db):
    delivery_id = make_delivery(client, owner_headers, products, quantity=10)  # Fanta 5 -> 15
    client.post(  # 13 sold, 2 left
        "/sales",
        json={"payment_method": "cash", "items": [{"product_id": products["fanta"].id, "quantity": 13}]},
        headers=shopkeeper_headers,
    )
    response = correct(client, owner_headers, delivery_id, products["fanta"].id, -5)
    assert response.status_code == 409
    assert response.json()["error"] == "not_enough_stock"
    assert response.json()["available"] == 2
    assert stock_of(db, products["fanta"]) == 2
    assert count(db, StockEntry) == 0


def test_correction_shows_in_delivery_detail(client, owner_headers, shopkeeper_headers, products):
    delivery_id = make_delivery(client, owner_headers, products)
    correct(client, owner_headers, delivery_id, products["fanta"].id, -2, "Two were broken in the truck")
    correct(client, owner_headers, delivery_id, products["fanta"].id, 1, "Found one more")

    detail = client.get(f"/deliveries/{delivery_id}", headers=shopkeeper_headers).json()
    assert [(c["quantity_change"], c["reason"]) for c in detail["corrections"]] == [
        (1, "Found one more"),  # newest first
        (-2, "Two were broken in the truck"),
    ]


def test_shopkeeper_cannot_correct_a_delivery(client, owner_headers, shopkeeper_headers, products, db):
    delivery_id = make_delivery(client, owner_headers, products)
    response = correct(client, shopkeeper_headers, delivery_id, products["fanta"].id, -2)
    assert response.status_code == 403
    assert stock_of(db, products["fanta"]) == 29
    assert count(db, StockEntry) == 0
