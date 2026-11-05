# The database tables, written as Python classes (source: docs/database-design.md).
# One class = one table. One attribute = one column.
from datetime import date, datetime

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import DEPOT_TIMEZONE
from app.database import Base

ROLE_OWNER = "owner"
ROLE_SHOPKEEPER = "shopkeeper"
PAYMENT_METHODS = ("cash", "mobile_money")


def now_local() -> datetime:
    """Depot time (Tanzania), without microseconds, e.g. 2026-11-04 12:10:00."""
    return datetime.now(DEPOT_TIMEZONE).replace(tzinfo=None, microsecond=0)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'shopkeeper')", name="ck_users_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))  # never the plain password
    role: Mapped[str] = mapped_column(String(20))
    failed_attempts: Mapped[int] = mapped_column(default=0)
    is_locked: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)  # deactivate, never delete

    @property
    def is_owner(self) -> bool:
        return self.role == ROLE_OWNER


class ProductGroup(Base):
    """An item, e.g. Soda. Holds the default price for its sub-items."""

    __tablename__ = "product_groups"
    __table_args__ = (CheckConstraint("current_price >= 0", name="ck_groups_price"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    current_price: Mapped[int]  # whole TSh
    is_active: Mapped[bool] = mapped_column(default=True)

    products: Mapped[list["Product"]] = relationship(back_populates="group")


class Product(Base):
    """A sub-item, e.g. Fanta. Stock is counted here."""

    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("group_id", "name", name="uq_products_group_name"),
        # Rule 1: stock can never go below 0. The database itself refuses it.
        CheckConstraint("quantity_in_store >= 0", name="ck_products_stock"),
        CheckConstraint("own_price IS NULL OR own_price >= 0", name="ck_products_price"),
        CheckConstraint("min_level >= 0", name="ck_products_min_level"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("product_groups.id"))
    name: Mapped[str] = mapped_column(String(100))
    own_price: Mapped[int | None]  # None = use the group price
    quantity_in_store: Mapped[int] = mapped_column(default=0)
    min_level: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)  # False = stopped selling

    group: Mapped[ProductGroup] = relationship(back_populates="products")

    @property
    def effective_price(self) -> int:
        """The sub-item's own price if it has one, otherwise the item price."""
        if self.own_price is not None:
            return self.own_price
        return self.group.current_price

    @property
    def stock_status(self) -> str:
        if self.quantity_in_store == 0:
            return "OUT"
        if self.quantity_in_store <= self.min_level:
            return "LOW"
        return "OK"


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (
        # Exactly one of group_id or product_id is set.
        CheckConstraint(
            "(group_id IS NULL AND product_id IS NOT NULL)"
            " OR (group_id IS NOT NULL AND product_id IS NULL)",
            name="ck_price_history_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("product_groups.id"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    price: Mapped[int | None]  # None when a sub-item's own price was removed
    changed_at: Mapped[datetime] = mapped_column(default=now_local)
    changed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))


class Delivery(Base):
    """One restocking day. Its products are in delivery_items."""

    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(primary_key=True)
    delivered_at: Mapped[date]
    received_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["DeliveryItem"]] = relationship(back_populates="delivery")


class DeliveryItem(Base):
    __tablename__ = "delivery_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_delivery_items_quantity"),
        CheckConstraint(
            "buying_price IS NULL OR buying_price >= 0", name="ck_delivery_items_price"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    delivery_id: Mapped[int] = mapped_column(ForeignKey("deliveries.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int]
    buying_price: Mapped[int | None]  # owner only; for profit reports later

    delivery: Mapped[Delivery] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class StockEntry(Base):
    """A correction or adjustment. Added, never edited or deleted."""

    __tablename__ = "stock_entries"
    __table_args__ = (
        CheckConstraint("kind IN ('correction', 'adjustment')", name="ck_entries_kind"),
        CheckConstraint("quantity_change <> 0", name="ck_entries_change"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    delivery_id: Mapped[int | None] = mapped_column(ForeignKey("deliveries.id"))
    kind: Mapped[str] = mapped_column(String(20))
    quantity_change: Mapped[int]  # signed: -2 removes 2, +3 adds 3
    reason: Mapped[str] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=now_local)


class Sale(Base):
    """One customer's bill. Its products are in sale_items."""

    __tablename__ = "sales"
    __table_args__ = (
        CheckConstraint(
            "payment_method IN ('cash', 'mobile_money')", name="ck_sales_payment"
        ),
        CheckConstraint("total >= 0", name="ck_sales_total"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sold_at: Mapped[datetime] = mapped_column(default=now_local)
    sold_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    payment_method: Mapped[str] = mapped_column(String(20))
    total: Mapped[int]

    seller: Mapped[User] = relationship()
    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale")


class SaleItem(Base):
    """One line on a receipt. unit_price is a copy of the price at the time of sale."""

    __tablename__ = "sale_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sale_items_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_sale_items_price"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int]
    unit_price: Mapped[int]
    line_total: Mapped[int]

    sale: Mapped[Sale] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()
