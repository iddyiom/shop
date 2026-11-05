# Tests for the add-demo-users command. Spec: docs/specs/d01-demo-login.md, section 6.
import json

import pytest
from sqlalchemy import select

from app.manage import DEMO_ACCOUNTS_FILE, add_demo_users
from app.models import User
from app.security import verify_password

LOCAL = "sqlite:///C:/somewhere/depot.db"
ACCOUNTS = json.loads(DEMO_ACCOUNTS_FILE.read_text(encoding="utf-8"))["accounts"]


def user_named(db, username):
    db.expire_all()
    return db.scalar(select(User).where(User.username == username))


def test_add_demo_users_creates_owner_and_shopkeeper_with_hashed_passwords(db):
    add_demo_users(db, LOCAL)
    for account in ACCOUNTS:
        user = user_named(db, account["username"])
        assert user.role == account["role"]
        assert user.password_hash != account["password"]  # never stored in plain text
        assert verify_password(account["password"], user.password_hash)
    assert {a["role"] for a in ACCOUNTS} == {"owner", "shopkeeper"}


def test_running_again_resets_password_and_unlocks(db):
    add_demo_users(db, LOCAL)
    shop = ACCOUNTS[1]
    user = user_named(db, shop["username"])
    user.is_locked, user.failed_attempts, user.password_hash = True, 3, "changed"
    db.commit()

    add_demo_users(db, LOCAL)
    user = user_named(db, shop["username"])
    assert (user.is_locked, user.failed_attempts) == (False, 0)
    assert verify_password(shop["password"], user.password_hash)


def test_refuses_when_database_is_not_local_sqlite(db):
    with pytest.raises(SystemExit, match="only for a local SQLite"):
        add_demo_users(db, "postgresql+psycopg://depot@server/depot")
    assert user_named(db, ACCOUNTS[0]["username"]) is None


def test_other_users_are_not_touched(db, owner):
    before = owner.password_hash
    add_demo_users(db, LOCAL)
    assert user_named(db, "owner").password_hash == before
