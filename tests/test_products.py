# Tests for sub-items (products). Spec: docs/specs/05-items.md, section 7.
from sqlalchemy import select

from app.models import PriceHistory, Product, ProductGroup


def add_sub_item(client, headers, group_id, name, **extra):
    return client.post("/products", json={"group_id": group_id, "name": name, **extra}, headers=headers)


def soda_id(products):
    return products["fanta"].group_id


def test_owner_adds_sub_item_starting_at_zero_stock(client, owner_headers, products):
    response = add_sub_item(client, owner_headers, soda_id(products), "Pepsi", min_level=6)
    assert response.status_code == 201
    pepsi = response.json()
    assert pepsi["group"] == "Soda"
    assert pepsi["quantity_in_store"] == 0
    assert pepsi["min_level"] == 6
    assert pepsi["stock_status"] == "OUT"
    assert pepsi["is_active"] is True


def test_sub_item_without_own_price_uses_item_price(client, owner_headers, products, db):
    pepsi = add_sub_item(client, owner_headers, soda_id(products), "Pepsi").json()
    assert pepsi["own_price"] is None
    assert pepsi["effective_price"] == 1000
    db.expire_all()
    assert list(db.scalars(select(PriceHistory))) == []  # no own price, so no history row

    juice = add_sub_item(client, owner_headers, soda_id(products), "Juice", own_price=1300).json()
    assert juice["effective_price"] == 1300
    rows = list(db.scalars(select(PriceHistory).where(PriceHistory.product_id == juice["id"])))
    assert [row.price for row in rows] == [1300]  # rule 3: the first own price is recorded


def test_sub_item_name_unique_inside_item_only(client, owner_headers, products):
    assert add_sub_item(client, owner_headers, soda_id(products), "fanta").status_code == 409
    # "Fanta" inside another item is fine.
    biscuit = products["chocolate"].group_id
    assert add_sub_item(client, owner_headers, biscuit, "Fanta").status_code == 201
    # Renaming Coca-Cola to Fanta (same item) is refused.
    response = client.patch(
        f"/products/{products['coca'].id}", json={"name": "FANTA"}, headers=owner_headers
    )
    assert response.status_code == 409


def test_cannot_add_sub_item_to_unknown_or_stopped_item(client, owner_headers, products):
    response = add_sub_item(client, owner_headers, 999, "Pepsi")
    assert response.status_code == 422
    assert response.json()["error"] == "unknown_item"

    client.patch(f"/groups/{soda_id(products)}", json={"is_active": False}, headers=owner_headers)
    response = add_sub_item(client, owner_headers, soda_id(products), "Pepsi")
    assert response.status_code == 409
    assert response.json()["error"] == "item_stopped"


def test_set_own_price_then_remove_it(client, owner_headers, products, db):
    url = f"/products/{products['fanta'].id}/price"

    response = client.put(url, json={"price": 1100}, headers=owner_headers)
    assert response.json() == {"old_price": None, "new_price": 1100, "changed": True}
    response = client.put(url, json={"price": None}, headers=owner_headers)
    assert response.json() == {"old_price": 1100, "new_price": None, "changed": True}
    # Same again (still no own price): nothing changes.
    assert client.put(url, json={"price": None}, headers=owner_headers).json()["changed"] is False
    # The price key must be sent, even when it is null.
    assert client.put(url, json={}, headers=owner_headers).status_code == 422

    db.expire_all()
    rows = db.scalars(
        select(PriceHistory).where(PriceHistory.product_id == products["fanta"].id).order_by(PriceHistory.id)
    )
    assert [row.price for row in rows] == [1100, None]
    assert db.get(Product, products["fanta"].id).effective_price == 1000  # back to the item price


def test_patch_cannot_change_stock_or_price(client, owner_headers, products, db):
    response = client.patch(
        f"/products/{products['fanta'].id}",
        json={"quantity_in_store": 999, "own_price": 1, "min_level": 3},
        headers=owner_headers,
    )
    assert response.status_code == 200
    db.expire_all()
    fanta = db.get(Product, products["fanta"].id)
    assert fanta.quantity_in_store == 5  # unchanged
    assert fanta.own_price is None  # unchanged
    assert fanta.min_level == 3  # this one IS allowed


def test_stop_sub_item_keeps_stock_and_bring_back_restores_it(
    client, owner_headers, shopkeeper_headers, products
):
    url = f"/products/{products['fanta'].id}"
    sell_fanta = {"payment_method": "cash", "items": [{"product_id": products["fanta"].id, "quantity": 1}]}

    stopped = client.patch(url, json={"is_active": False}, headers=owner_headers).json()
    assert stopped["is_active"] is False
    assert stopped["quantity_in_store"] == 5  # stock kept
    assert client.post("/sales", json=sell_fanta, headers=shopkeeper_headers).status_code == 409

    listed = client.get("/products?include_stopped=true", headers=owner_headers).json()
    assert next(p for p in listed if p["name"] == "Fanta")["quantity_in_store"] == 5

    back = client.patch(url, json={"is_active": True}, headers=owner_headers).json()
    assert back["quantity_in_store"] == 5
    assert client.post("/sales", json=sell_fanta, headers=shopkeeper_headers).status_code == 201


def test_list_products_shows_effective_price_and_status(client, shopkeeper_headers, products):
    listed = client.get("/products", headers=shopkeeper_headers).json()
    by_name = {p["name"]: p for p in listed}
    assert by_name["Fanta"]["effective_price"] == 1000
    assert by_name["Water kubwa"]["effective_price"] == 1500  # own price
    assert by_name["Coca-Cola"]["stock_status"] == "OUT"
    assert by_name["Fanta"]["stock_status"] == "OK"

    only_soda = client.get(f"/products?group_id={soda_id(products)}", headers=shopkeeper_headers).json()
    assert {p["name"] for p in only_soda} == {"Fanta", "Coca-Cola"}


def test_shopkeeper_cannot_add_edit_or_reprice_sub_item(client, shopkeeper_headers, products, db):
    fanta = products["fanta"].id
    attempts = [
        add_sub_item(client, shopkeeper_headers, soda_id(products), "Pepsi"),
        client.patch(f"/products/{fanta}", json={"name": "Cheap"}, headers=shopkeeper_headers),
        client.patch(f"/products/{fanta}", json={"is_active": False}, headers=shopkeeper_headers),
        client.put(f"/products/{fanta}/price", json={"price": 1}, headers=shopkeeper_headers),
    ]
    assert [response.status_code for response in attempts] == [403] * 4
    db.expire_all()
    assert db.get(Product, fanta).own_price is None
    assert db.scalar(select(ProductGroup).where(ProductGroup.name == "Soda")) is not None


def test_unknown_sub_item_is_404(client, owner_headers, products):
    assert client.patch("/products/999", json={"name": "X"}, headers=owner_headers).status_code == 404
    assert client.put("/products/999/price", json={"price": 5}, headers=owner_headers).status_code == 404
