# Tests for editing and deactivating users: PATCH /users/{id} (unit B1).
from app.models import User
from tests.conftest import TEST_PASSWORD


def login(client, username, password):
    return client.post("/auth/login", json={"username": username, "password": password})


def patch_user(client, user_id, body, headers):
    return client.patch(f"/users/{user_id}", json=body, headers=headers)


def saved_user(db, user_id):
    """Read the user again from the database, not from the response."""
    db.expire_all()  # forget cached rows, so we see what the request saved
    return db.get(User, user_id)


def test_owner_renames_user(client, db, shopkeeper, owner_headers):
    response = patch_user(client, shopkeeper.id, {"full_name": "Asha Juma"}, owner_headers)

    assert response.status_code == 200
    assert response.json()["full_name"] == "Asha Juma"
    assert saved_user(db, shopkeeper.id).full_name == "Asha Juma"


def test_name_is_trimmed_and_empty_name_refused(client, db, shopkeeper, owner_headers):
    trimmed = patch_user(client, shopkeeper.id, {"full_name": "  Asha  "}, owner_headers)
    assert trimmed.json()["full_name"] == "Asha"

    empty = patch_user(client, shopkeeper.id, {"full_name": "   "}, owner_headers)
    assert empty.status_code == 422
    assert saved_user(db, shopkeeper.id).full_name == "Asha"


def test_empty_body_changes_nothing(client, db, shopkeeper, owner_headers):
    response = patch_user(client, shopkeeper.id, {}, owner_headers)

    assert response.status_code == 200
    user = saved_user(db, shopkeeper.id)
    assert user.full_name == "Shop Keeper"
    assert user.is_active is True


def test_unknown_field_like_role_is_refused(client, db, shopkeeper, owner_headers):
    response = patch_user(client, shopkeeper.id, {"role": "owner"}, owner_headers)

    assert response.status_code == 422
    assert saved_user(db, shopkeeper.id).role == "shopkeeper"


def test_owner_deactivates_user_who_then_cannot_log_in(client, db, shopkeeper, owner_headers):
    response = patch_user(client, shopkeeper.id, {"is_active": False}, owner_headers)

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert saved_user(db, shopkeeper.id).is_active is False
    assert login(client, "shopkeeper", TEST_PASSWORD).status_code == 401


def test_deactivated_users_token_stops_working(
    client, shopkeeper, shopkeeper_headers, owner_headers
):
    # The shopkeeper is logged in and working.
    assert client.get("/auth/me", headers=shopkeeper_headers).status_code == 200

    patch_user(client, shopkeeper.id, {"is_active": False}, owner_headers)

    # Their very next request is refused, with the same token.
    assert client.get("/auth/me", headers=shopkeeper_headers).status_code == 401


def test_owner_reactivates_user(client, db, shopkeeper, owner_headers):
    patch_user(client, shopkeeper.id, {"is_active": False}, owner_headers)
    response = patch_user(client, shopkeeper.id, {"is_active": True}, owner_headers)

    assert response.json()["is_active"] is True
    assert login(client, "shopkeeper", TEST_PASSWORD).status_code == 200


def test_reactivating_keeps_account_locked(client, db, shopkeeper, owner_headers):
    for _ in range(3):
        login(client, "shopkeeper", "wrong")  # 3 wrong tries lock the account
    patch_user(client, shopkeeper.id, {"is_active": False}, owner_headers)

    response = patch_user(client, shopkeeper.id, {"is_active": True}, owner_headers)

    assert response.json()["is_locked"] is True
    assert login(client, "shopkeeper", TEST_PASSWORD).status_code == 423


def test_owner_cannot_deactivate_self(client, db, owner, owner_headers):
    response = patch_user(client, owner.id, {"is_active": False}, owner_headers)

    assert response.status_code == 409
    assert response.json()["error"] == "cannot_deactivate_self"
    assert saved_user(db, owner.id).is_active is True

    # Renaming yourself is fine.
    rename = patch_user(client, owner.id, {"full_name": "Mzee Juma"}, owner_headers)
    assert rename.status_code == 200


def test_patch_unknown_user_is_404(client, owner_headers):
    response = patch_user(client, 9999, {"full_name": "Nobody"}, owner_headers)
    assert response.status_code == 404


def test_shopkeeper_cannot_edit_users(client, db, owner, shopkeeper_headers):
    response = patch_user(client, owner.id, {"is_active": False}, shopkeeper_headers)

    assert response.status_code == 403
    assert saved_user(db, owner.id).is_active is True
