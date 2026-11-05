# Tests for items (product groups). Spec: docs/specs/05-items.md, section 7.
from sqlalchemy import select

from app.models import PriceHistory, ProductGroup


def history_rows(db, **where):
    db.expire_all()
    query = select(PriceHistory).filter_by(**where).order_by(PriceHistory.id)
    return list(db.scalars(query))


def soda_id(products):
    return products["fanta"].group_id


def test_owner_adds_item_and_first_price_is_in_history(client, owner_headers, owner, db):
    response = client.post("/groups", json={"name": "  Juice ", "price": 1200}, headers=owner_headers)
    assert response.status_code == 201
    item = response.json()
    assert item["name"] == "Juice"  # spaces trimmed
    assert item["current_price"] == 1200
    assert item["is_active"] is True

    rows = history_rows(db, group_id=item["id"])
    assert [(row.price, row.changed_by) for row in rows] == [(1200, owner.id)]


def test_item_name_must_be_unique_ignoring_case(client, owner_headers, products):
    response = client.post("/groups", json={"name": "soda", "price": 900}, headers=owner_headers)
    assert response.status_code == 409
    assert response.json()["error"] == "name_taken"


def test_list_items_for_shopkeeper(client, shopkeeper_headers, products):
    response = client.get("/groups", headers=shopkeeper_headers)
    assert response.status_code == 200
    names = [item["name"] for item in response.json()]
    assert names == ["Biscuit", "Soda", "Water kubwa"]  # sorted by name


def test_owner_renames_item(client, owner_headers, products):
    url = f"/groups/{soda_id(products)}"
    assert client.patch(url, json={"name": "Soft drinks"}, headers=owner_headers).json()["name"] == "Soft drinks"
    # Renaming to its own name is fine; to another item's name is not.
    assert client.patch(url, json={"name": "Soft drinks"}, headers=owner_headers).status_code == 200
    assert client.patch(url, json={"name": "BISCUIT"}, headers=owner_headers).status_code == 409


def test_change_item_price_returns_old_and_new_and_adds_history(client, owner_headers, products, db):
    response = client.put(f"/groups/{soda_id(products)}/price", json={"price": 1200}, headers=owner_headers)
    assert response.status_code == 200
    assert response.json() == {"old_price": 1000, "new_price": 1200, "changed": True}
    assert [row.price for row in history_rows(db, group_id=soda_id(products))] == [1200]


def test_same_price_again_adds_no_history(client, owner_headers, products, db):
    response = client.put(f"/groups/{soda_id(products)}/price", json={"price": 1000}, headers=owner_headers)
    assert response.json() == {"old_price": 1000, "new_price": 1000, "changed": False}
    assert history_rows(db, group_id=soda_id(products)) == []


def test_negative_or_missing_price_is_rejected(client, owner_headers, products):
    url = f"/groups/{soda_id(products)}/price"
    assert client.put(url, json={"price": -1}, headers=owner_headers).status_code == 422
    assert client.put(url, json={}, headers=owner_headers).status_code == 422
    assert client.put(url, json={"price": None}, headers=owner_headers).status_code == 422
    assert client.post("/groups", json={"name": "", "price": 5}, headers=owner_headers).status_code == 422


def test_old_receipt_keeps_old_price_after_item_price_change(
    client, owner_headers, shopkeeper_headers, products
):
    sale = client.post(
        "/sales",
        json={"payment_method": "cash", "items": [{"product_id": products["fanta"].id, "quantity": 1}]},
        headers=shopkeeper_headers,
    ).json()
    client.put(f"/groups/{soda_id(products)}/price", json={"price": 1200}, headers=owner_headers)

    old_receipt = client.get(f"/sales/{sale['id']}", headers=shopkeeper_headers).json()
    assert old_receipt["items"][0]["unit_price"] == 1000
    fanta = client.get("/products", headers=shopkeeper_headers).json()
    assert next(p for p in fanta if p["name"] == "Fanta")["effective_price"] == 1200


def test_stop_item_blocks_selling_and_bring_back_restores(
    client, owner_headers, shopkeeper_headers, products
):
    url = f"/groups/{soda_id(products)}"
    sell_fanta = {"payment_method": "cash", "items": [{"product_id": products["fanta"].id, "quantity": 1}]}

    assert client.patch(url, json={"is_active": False}, headers=owner_headers).json()["is_active"] is False
    assert client.post("/sales", json=sell_fanta, headers=shopkeeper_headers).status_code == 409

    # Hidden from the normal lists, shown with include_stopped.
    assert "Soda" not in [g["name"] for g in client.get("/groups", headers=shopkeeper_headers).json()]
    all_groups = client.get("/groups?include_stopped=true", headers=owner_headers).json()
    assert "Soda" in [g["name"] for g in all_groups]
    assert "Fanta" not in [p["name"] for p in client.get("/products", headers=shopkeeper_headers).json()]

    client.patch(url, json={"is_active": True}, headers=owner_headers)
    assert client.post("/sales", json=sell_fanta, headers=shopkeeper_headers).status_code == 201


def test_price_history_includes_sub_items_newest_first(client, owner_headers, products):
    soda = soda_id(products)
    client.put(f"/groups/{soda}/price", json={"price": 1200}, headers=owner_headers)
    client.put(f"/products/{products['fanta'].id}/price", json={"price": 1100}, headers=owner_headers)
    # A change in another item must not appear.
    client.put(f"/products/{products['chocolate'].id}/price", json={"price": 600}, headers=owner_headers)

    history = client.get(f"/groups/{soda}/price-history", headers=owner_headers).json()
    assert [(h["target"], h["name"], h["price"]) for h in history] == [
        ("sub-item", "Fanta", 1100),
        ("item", "Soda", 1200),
    ]
    assert history[0]["changed_by"] == "Depot Owner"


def test_shopkeeper_cannot_add_rename_reprice_or_see_history(client, shopkeeper_headers, products, db):
    soda = soda_id(products)
    attempts = [
        client.post("/groups", json={"name": "Juice", "price": 1200}, headers=shopkeeper_headers),
        client.patch(f"/groups/{soda}", json={"name": "Cheap"}, headers=shopkeeper_headers),
        client.patch(f"/groups/{soda}", json={"is_active": False}, headers=shopkeeper_headers),
        client.put(f"/groups/{soda}/price", json={"price": 1}, headers=shopkeeper_headers),
        client.get(f"/groups/{soda}/price-history", headers=shopkeeper_headers),
    ]
    assert [response.status_code for response in attempts] == [403] * 5
    db.expire_all()
    assert db.get(ProductGroup, soda).current_price == 1000  # nothing changed


def test_unknown_item_is_404(client, owner_headers, products):
    assert client.patch("/groups/999", json={"name": "X"}, headers=owner_headers).status_code == 404
    assert client.put("/groups/999/price", json={"price": 5}, headers=owner_headers).status_code == 404
    assert client.get("/groups/999/price-history", headers=owner_headers).status_code == 404


def test_must_be_logged_in_to_list_items(client, products):
    assert client.get("/groups").status_code == 401
