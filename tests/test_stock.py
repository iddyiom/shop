# Tests for the store balance, adjustments and stock history. Spec: docs/specs/07-stock.md, section 7.
# Example data (conftest.py): Fanta 5, Coca-Cola 0 (Soda); Chocolate 10 (Biscuit); Water kubwa 4.
from datetime import timedelta

from sqlalchemy import func, select

from app.models import Product, StockEntry, now_local


def stock_of(db, product):
    db.expire_all()
    return db.get(Product, product.id).quantity_in_store


def adjust(client, headers, product_id, direction, quantity, reason):
    return client.post(
        f"/products/{product_id}/adjustments",
        json={"direction": direction, "quantity": quantity, "reason": reason},
        headers=headers,
    )


def names(response):
    return [line["product"] for line in response.json()]


# ---------- Store balance ----------


def test_stock_shows_every_active_sub_item_with_status(client, shopkeeper_headers, products):
    response = client.get("/stock", headers=shopkeeper_headers)
    assert response.status_code == 200
    by_name = {line["product"]: line for line in response.json()}
    assert names(response) == ["Chocolate", "Coca-Cola", "Fanta", "Water kubwa"]  # item, then name
    assert by_name["Fanta"]["quantity_in_store"] == 5
    assert by_name["Fanta"]["group"] == "Soda"
    assert by_name["Coca-Cola"]["stock_status"] == "OUT"


def test_stock_search_and_group_filter(client, shopkeeper_headers, products):
    assert names(client.get("/stock?search=FAN", headers=shopkeeper_headers)) == ["Fanta"]
    # Searching an item name finds its sub-items.
    assert names(client.get("/stock?search=soda", headers=shopkeeper_headers)) == ["Coca-Cola", "Fanta"]
    # "%" is a normal character, not "match anything".
    assert names(client.get("/stock?search=%25", headers=shopkeeper_headers)) == []
    biscuit = products["chocolate"].group_id
    assert names(client.get(f"/stock?group_id={biscuit}", headers=shopkeeper_headers)) == ["Chocolate"]


def test_stock_hides_stopped_unless_asked(client, owner_headers, products):
    client.patch(f"/products/{products['fanta'].id}", json={"is_active": False}, headers=owner_headers)
    client.patch(f"/groups/{products['chocolate'].group_id}", json={"is_active": False}, headers=owner_headers)

    assert names(client.get("/stock", headers=owner_headers)) == ["Coca-Cola", "Water kubwa"]
    everything = client.get("/stock?include_stopped=true", headers=owner_headers)
    assert names(everything) == ["Chocolate", "Coca-Cola", "Fanta", "Water kubwa"]
    assert {line["product"]: line["quantity_in_store"] for line in everything.json()}["Fanta"] == 5


def test_low_stock_lists_out_first_then_low_and_skips_stopped(client, owner_headers, products, db):
    products["water"].min_level = 4  # 4 in store -> LOW
    products["chocolate"].min_level = 12  # 10 in store -> LOW
    db.commit()
    response = client.get("/stock/low", headers=owner_headers)
    assert [(line["product"], line["stock_status"]) for line in response.json()] == [
        ("Coca-Cola", "OUT"),
        ("Chocolate", "LOW"),
        ("Water kubwa", "LOW"),
    ]

    client.patch(f"/products/{products['coca'].id}", json={"is_active": False}, headers=owner_headers)
    assert "Coca-Cola" not in names(client.get("/stock/low", headers=owner_headers))


def test_stock_views_show_no_money(client, owner_headers, shopkeeper_headers, products):
    for headers in (owner_headers, shopkeeper_headers):
        for url in ("/stock", "/stock/low"):
            for line in client.get(url, headers=headers).json():
                assert not any("price" in key or "total" in key for key in line)


def test_must_be_logged_in_to_see_stock(client, products):
    assert client.get("/stock").status_code == 401
    assert client.get("/stock/low").status_code == 401


# ---------- Adjustments ----------


def test_owner_removes_damaged_stock_with_before_and_after(client, owner_headers, products, db):
    response = adjust(client, owner_headers, products["fanta"].id, "remove", 2, "Damaged")
    assert response.status_code == 201
    body = response.json()
    assert (body["before"], body["after"], body["quantity_change"]) == (5, 3, -2)
    assert (body["kind"], body["reason"], body["by"]) == ("adjustment", "Damaged", "Depot Owner")
    assert body["delivery_id"] is None
    assert stock_of(db, products["fanta"]) == 3


def test_counted_differently_can_add_stock(client, owner_headers, products, db):
    response = adjust(client, owner_headers, products["fanta"].id, "add", 3, "Counted differently")
    assert response.status_code == 201
    assert response.json()["quantity_change"] == 3
    assert stock_of(db, products["fanta"]) == 8


def test_damaged_expired_or_lost_cannot_add(client, owner_headers, products, db):
    for reason in ("Damaged", "Expired", "Lost or missing"):
        response = adjust(client, owner_headers, products["fanta"].id, "add", 1, reason)
        assert response.status_code == 422
        assert response.json()["error"] == "reason_needs_remove"
    assert stock_of(db, products["fanta"]) == 5


def test_unknown_reason_or_bad_quantity_is_rejected(client, owner_headers, products):
    fanta = products["fanta"].id
    assert adjust(client, owner_headers, fanta, "remove", 1, "Stolen by goats").status_code == 422
    assert adjust(client, owner_headers, fanta, "remove", 0, "Damaged").status_code == 422
    assert adjust(client, owner_headers, fanta, "remove", -3, "Damaged").status_code == 422
    assert adjust(client, owner_headers, fanta, "sideways", 1, "Damaged").status_code == 422


def test_adjustment_cannot_push_stock_below_zero(client, owner_headers, products, db):
    response = adjust(client, owner_headers, products["fanta"].id, "remove", 6, "Lost or missing")
    assert response.status_code == 409
    assert response.json()["error"] == "not_enough_stock"
    assert response.json()["available"] == 5
    assert stock_of(db, products["fanta"]) == 5
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(StockEntry)) == 0  # nothing saved


def test_adjustment_allowed_on_stopped_sub_item(client, owner_headers, products, db):
    client.patch(f"/products/{products['chocolate'].id}", json={"is_active": False}, headers=owner_headers)
    response = adjust(client, owner_headers, products["chocolate"].id, "remove", 10, "Expired")
    assert response.status_code == 201
    assert stock_of(db, products["chocolate"]) == 0


def test_unknown_sub_item_adjustment_is_404(client, owner_headers, products):
    assert adjust(client, owner_headers, 999, "remove", 1, "Damaged").status_code == 404


# ---------- History ----------


def make_correction(client, owner_headers, products):
    """Deliver 10 Fanta, then correct it by -1. Returns the delivery id."""
    delivery = client.post(
        "/deliveries", json={"items": [{"product_id": products["fanta"].id, "quantity": 10}]},
        headers=owner_headers,
    ).json()
    client.post(
        f"/deliveries/{delivery['id']}/corrections",
        json={"product_id": products["fanta"].id, "quantity_change": -1, "reason": "One short"},
        headers=owner_headers,
    )
    return delivery["id"]


def test_stock_entries_show_corrections_and_adjustments_newest_first(client, owner_headers, products):
    delivery_id = make_correction(client, owner_headers, products)
    adjust(client, owner_headers, products["chocolate"].id, "remove", 2, "Damaged")

    entries = client.get("/stock-entries", headers=owner_headers).json()
    assert [(e["kind"], e["product"], e["quantity_change"]) for e in entries] == [
        ("adjustment", "Chocolate", -2),
        ("correction", "Fanta", -1),
    ]
    assert entries[1]["delivery_id"] == delivery_id
    assert entries[1]["reason"] == "One short"


def test_stock_entries_filters(client, owner_headers, products, db):
    make_correction(client, owner_headers, products)
    adjust(client, owner_headers, products["fanta"].id, "remove", 1, "Damaged")
    adjust(client, owner_headers, products["chocolate"].id, "remove", 1, "Expired")

    def kinds(url):
        return [(e["kind"], e["product"]) for e in client.get(url, headers=owner_headers).json()]

    fanta = products["fanta"].id
    assert kinds(f"/stock-entries?product_id={fanta}") == [("adjustment", "Fanta"), ("correction", "Fanta")]
    assert kinds("/stock-entries?kind=correction") == [("correction", "Fanta")]
    assert client.get("/stock-entries?kind=other", headers=owner_headers).status_code == 422

    today = now_local().date()
    assert len(kinds(f"/stock-entries?day={today.isoformat()}")) == 3
    assert kinds(f"/stock-entries?day={(today - timedelta(days=1)).isoformat()}") == []


def test_shopkeeper_cannot_adjust_or_see_stock_entries(client, shopkeeper_headers, products, db):
    response = adjust(client, shopkeeper_headers, products["fanta"].id, "remove", 1, "Damaged")
    assert response.status_code == 403
    assert client.get("/stock-entries", headers=shopkeeper_headers).status_code == 403
    assert stock_of(db, products["fanta"]) == 5
