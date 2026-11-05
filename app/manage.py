# Commands you run in the terminal (not through the API):
#   python -m app.manage create-owner        make the first owner account
#   python -m app.manage unlock USERNAME     unlock an account (e.g. a locked owner)
#   python -m app.manage add-example-data    add the example items with opening stock
import argparse
import getpass
import sys

from sqlalchemy import inspect, select

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


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.manage")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("create-owner")
    commands.add_parser("unlock").add_argument("username")
    commands.add_parser("add-example-data")
    args = parser.parse_args()

    # Tables come from the migrations, never from here (docs/specs/09-migrations.md).
    if not inspect(engine).has_table("users"):
        sys.exit("The database has no tables yet. Run: alembic upgrade head")
    with SessionLocal() as db:
        if args.command == "create-owner":
            create_owner(db)
        elif args.command == "unlock":
            unlock(db, args.username)
        else:
            add_example_data(db)


if __name__ == "__main__":
    main()
