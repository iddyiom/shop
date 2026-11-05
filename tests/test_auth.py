# Tests for login, lockout and owner-only actions.
from app.models import User
from app.security import verify_password
from tests.conftest import TEST_PASSWORD


def login(client, username, password):
    return client.post("/auth/login", json={"username": username, "password": password})


def test_login_gives_token_that_works(client, shopkeeper):
    response = login(client, "shopkeeper", TEST_PASSWORD)
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["role"] == "shopkeeper"


def test_wrong_password_shows_tries_remaining(client, shopkeeper):
    first = login(client, "shopkeeper", "wrong")
    assert first.status_code == 401
    assert first.json()["attempts_remaining"] == 2

    second = login(client, "shopkeeper", "wrong")
    assert second.json()["attempts_remaining"] == 1


def test_third_wrong_password_locks_account(client, shopkeeper):
    login(client, "shopkeeper", "wrong")
    login(client, "shopkeeper", "wrong")
    third = login(client, "shopkeeper", "wrong")
    assert third.status_code == 423

    # Even the right password is refused now.
    assert login(client, "shopkeeper", TEST_PASSWORD).status_code == 423


def test_correct_password_resets_the_count(client, shopkeeper, db):
    login(client, "shopkeeper", "wrong")
    login(client, "shopkeeper", "wrong")
    assert login(client, "shopkeeper", TEST_PASSWORD).status_code == 200
    # Two more mistakes do not lock, because the count started again at 0.
    login(client, "shopkeeper", "wrong")
    assert login(client, "shopkeeper", "wrong").status_code == 401


def test_owner_unlocks_account(client, shopkeeper, owner_headers):
    for _ in range(3):
        login(client, "shopkeeper", "wrong")

    response = client.post(f"/users/{shopkeeper.id}/unlock", headers=owner_headers)
    assert response.status_code == 200
    assert login(client, "shopkeeper", TEST_PASSWORD).status_code == 200


def test_unknown_user_cannot_log_in(client):
    assert login(client, "nobody", "whatever").status_code == 401


def test_no_token_or_fake_token_is_refused(client):
    assert client.get("/auth/me").status_code == 401
    fake = {"Authorization": "Bearer not-a-real-token"}
    assert client.get("/auth/me", headers=fake).status_code == 401


def test_shopkeeper_cannot_manage_users(client, shopkeeper, shopkeeper_headers):
    assert client.get("/users", headers=shopkeeper_headers).status_code == 403
    unlock = client.post(f"/users/{shopkeeper.id}/unlock", headers=shopkeeper_headers)
    assert unlock.status_code == 403


def test_owner_creates_user_with_hashed_password(client, owner_headers, db):
    new_user = {
        "full_name": "Asha Juma",
        "username": "asha",
        "password": "asha-pass-2026",
        "role": "shopkeeper",
    }
    response = client.post("/users", json=new_user, headers=owner_headers)
    assert response.status_code == 201
    assert "password" not in response.json()

    saved = db.query(User).filter_by(username="asha").one()
    assert saved.password_hash != "asha-pass-2026"
    assert verify_password("asha-pass-2026", saved.password_hash)

    again = client.post("/users", json=new_user, headers=owner_headers)
    assert again.status_code == 409
