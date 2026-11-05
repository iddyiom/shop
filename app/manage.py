# Commands you run in the terminal (not through the API):
#   python -m app.manage create-owner        make the first owner account
#   python -m app.manage unlock USERNAME     unlock an account (e.g. a locked owner)
#   python -m app.manage add-example-data    add the example items with opening stock
#   python -m app.manage add-demo-users      DEVELOPMENT ONLY: demo owner and shopkeeper
import argparse
import getpass
import json
import sys

from sqlalchemy import inspect, select

from app.config import DATABASE_URL, PROJECT_DIR
from app.database import SessionLocal, engine
from app.models import (
    ROLE_OWNER, Delivery, DeliveryItem, Product, ProductGroup, User, now_local,
)
from app.schemas import UserCreate
from app.security import hash_password

# From docs/database-design.md: (item, item price, [(sub-item, own price)])
EXAMPLE_ITEMS = [
    ("Soda", 1000, [("Coca-Cola", None), ("Fanta", None), ("Sprite", None)]),
    ("Biscuit", 500, [("Chocolate", None), ("Vanilla", None)]),
    ("Water ndogo", 500, [("Water ndogo", None)]),
    ("Water kubwa", 1500, [("Water kubwa", 1500)]),
]
OPENING_STOCK = 24


def create_owner(db) -> None:
    full_name = input("Full name: ").strip()
    username = input("Username: ").strip()
    password = getpass.getpass("Password (min 8 characters, hidden): ")
    if password != getpass.getpass("Type the password again: "):
        sys.exit("Passwords do not match.")

    details = UserCreate(full_name=full_name, username=username, password=password, role=ROLE_OWNER)
    if db.scalar(select(User).where(User.username == details.username)):
        sys.exit("That username is already used.")
    db.add(User(
        full_name=details.full_name,
        username=details.username,
        password_hash=hash_password(details.password),
        role=ROLE_OWNER,
    ))
    db.commit()
    print(f"Owner '{details.username}' created.")


def unlock(db, username: str) -> None:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        sys.exit("No such user.")
    user.is_locked = False
    user.failed_attempts = 0
    db.commit()
    print(f"'{username}' is unlocked.")


def add_example_data(db) -> None:
    owner = db.scalar(select(User).where(User.role == ROLE_OWNER))
    if owner is None:
        sys.exit("Create the owner first: python -m app.manage create-owner")
    if db.scalar(select(ProductGroup)):
        sys.exit("Items already exist. Nothing added.")

    # Stock only enters through a delivery, so history stays complete.
    delivery = Delivery(delivered_at=now_local().date(), received_by=owner.id, note="Opening stock")
    for group_name, group_price, sub_items in EXAMPLE_ITEMS:
        group = ProductGroup(name=group_name, current_price=group_price)
        for name, own_price in sub_items:
            product = Product(group=group, name=name, own_price=own_price,
                              quantity_in_store=OPENING_STOCK, min_level=5)
            delivery.items.append(DeliveryItem(product=product, quantity=OPENING_STOCK))
        db.add(group)
    db.add(delivery)
    db.commit()
    print(f"Example items added, each with {OPENING_STOCK} in store.")


DEMO_ACCOUNTS_FILE = PROJECT_DIR / "frontend" / "dev-accounts.json"


def add_demo_users(db, database_url: str = DATABASE_URL) -> None:
    """Create (or reset) the demo accounts from frontend/dev-accounts.json. Local SQLite only."""
    # Their passwords are written in Git: they must never exist on a real server.
    if not database_url.startswith("sqlite:///"):
        sys.exit("Refused: demo accounts are only for a local SQLite database.")

    accounts = json.loads(DEMO_ACCOUNTS_FILE.read_text(encoding="utf-8"))["accounts"]
    for account in accounts:
        details = UserCreate(  # same checks as a real account (name, username, password length)
            full_name=account["full_name"], username=account["username"],
            password=account["password"], role=account["role"],
        )
        user = db.scalar(select(User).where(User.username == details.username))
        if user is None:
            user = User(username=details.username)
            db.add(user)
        # New or existing: back to a clean, working demo account.
        user.full_name = details.full_name
        user.role = details.role
        user.password_hash = hash_password(details.password)  # hashed, like every account
        user.is_locked = False
        user.failed_attempts = 0
        user.is_active = True
    db.commit()
    names = ", ".join(f"{a['username']} ({a['role']})" for a in accounts)
    print(f"Demo accounts ready: {names}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.manage")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("create-owner")
    commands.add_parser("unlock").add_argument("username")
    commands.add_parser("add-example-data")
    commands.add_parser("add-demo-users")
    args = parser.parse_args()

    # Tables come from the migrations, never from here (docs/specs/09-migrations.md).
    if not inspect(engine).has_table("users"):
        sys.exit("The database has no tables yet. Run: alembic upgrade head")
    with SessionLocal() as db:
        if args.command == "create-owner":
            create_owner(db)
        elif args.command == "unlock":
            unlock(db, args.username)
        elif args.command == "add-demo-users":
            add_demo_users(db)
        else:
            add_example_data(db)


if __name__ == "__main__":
    main()
