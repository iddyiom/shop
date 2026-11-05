# The shape of the JSON that comes IN to the API and goes OUT of it.
# Pydantic checks incoming data and rejects bad input with a 422 error.
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.security import MAX_PASSWORD_BYTES

MAX_PRICE = 10_000_000  # TSh. Stops typing mistakes like an extra few zeros.

# ---------- Auth and users ----------


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # can be built from a User row

    id: int
    full_name: str
    username: str
    role: str
    is_locked: bool
    is_active: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.]+$")
    password: str = Field(min_length=8)
    role: Literal["owner", "shopkeeper"]

    @field_validator("password")
    @classmethod
    def password_not_too_long(cls, password: str) -> str:
        if len(password.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError("Password is too long")
        return password


# ---------- Sales ----------


class SaleLineIn(BaseModel):
    """What the screen sends: only WHICH product and HOW MANY. Never a price."""

    product_id: int
    quantity: int = Field(gt=0, le=100_000)


class SaleCreate(BaseModel):
    payment_method: Literal["cash", "mobile_money"]
    items: list[SaleLineIn] = Field(min_length=1)


class ReceiptLine(BaseModel):
    product_id: int
    product: str
    quantity: int
    unit_price: int
    line_total: int


class Receipt(BaseModel):
    id: int
    sold_at: datetime
    sold_by: str
    payment_method: str
    items: list[ReceiptLine]
    total: int


# ---------- Items and sub-items ----------

# A name: spaces at both ends are removed, then it must be 1 to 100 characters.
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
# A price in whole TSh.
Price = Annotated[int, Field(ge=0, le=MAX_PRICE)]


class GroupCreate(BaseModel):
    name: Name
    price: Price


class GroupUpdate(BaseModel):
    """Only what is sent changes. There is no price here: prices have their own endpoint."""

    name: Name | None = None
    is_active: bool | None = None


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    current_price: int
    is_active: bool


class GroupPriceSet(BaseModel):
    price: Price


class ProductCreate(BaseModel):
    group_id: int
    name: Name
    own_price: Price | None = None  # None = use the item price
    min_level: int = Field(default=0, ge=0, le=100_000)


class ProductUpdate(BaseModel):
    """Only what is sent changes. No price and no stock here, on purpose."""

    name: Name | None = None
    min_level: int | None = Field(default=None, ge=0, le=100_000)
    is_active: bool | None = None


class ProductOut(BaseModel):
    id: int
    name: str
    group_id: int
    group: str  # the item's name, e.g. "Soda"
    own_price: int | None
    effective_price: int  # the price a sale will charge
    quantity_in_store: int
    min_level: int
    stock_status: Literal["OK", "LOW", "OUT"]
    is_active: bool


class ProductPriceSet(BaseModel):
    price: Price | None  # required, but may be null: null = use the item price again


class PriceChangeOut(BaseModel):
    old_price: int | None
    new_price: int | None
    changed: bool  # False when the new price was the same as the old one


class PriceHistoryOut(BaseModel):
    target: Literal["item", "sub-item"]
    name: str
    price: int | None
    changed_at: datetime
    changed_by: str


# ---------- Deliveries ----------

Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class DeliveryLineIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=100_000)
    buying_price: Price | None = None  # per unit; the owner only may send it


class DeliveryCreate(BaseModel):
    delivered_at: date | None = None  # None = today (depot time)
    note: Note | None = None
    items: list[DeliveryLineIn] = Field(min_length=1)


class CorrectionCreate(BaseModel):
    product_id: int
    quantity_change: int = Field(ge=-100_000, le=100_000)  # signed: -2 removes 2
    reason: Note

    @field_validator("quantity_change")
    @classmethod
    def not_zero(cls, change: int) -> int:
        if change == 0:
            raise ValueError("Quantity change cannot be 0")
        return change


class DeliveryLineOut(BaseModel):
    """A delivery line as a shopkeeper sees it: no buying price."""

    product_id: int
    product: str
    quantity: int


class DeliveryLineOwnerOut(DeliveryLineOut):
    buying_price: int | None


class CorrectionEntryOut(BaseModel):
    """One correction, as listed inside a delivery."""

    id: int
    product_id: int
    product: str
    quantity_change: int
    reason: str
    by: str
    at: datetime


class CorrectionOut(CorrectionEntryOut):
    """The answer to POST .../corrections: also the stock before and after."""

    delivery_id: int
    before: int
    after: int


class DeliveryOut(BaseModel):
    """A delivery as a shopkeeper sees it."""

    id: int
    delivered_at: date
    received_by: str
    note: str | None
    items: list[DeliveryLineOut]
    corrections: list[CorrectionEntryOut]


class DeliveryOwnerOut(DeliveryOut):
    """A delivery as the owner sees it: lines include the buying price."""

    items: list[DeliveryLineOwnerOut]


# ---------- Store balance and adjustments ----------

REMOVE_ONLY_REASONS = ("Damaged", "Expired", "Lost or missing")


class StockLineOut(BaseModel):
    """One sub-item's balance. Quantities only: no money here (rule 1)."""

    product_id: int
    product: str
    group_id: int
    group: str
    quantity_in_store: int
    min_level: int
    stock_status: Literal["OK", "LOW", "OUT"]
    is_active: bool


class AdjustmentCreate(BaseModel):
    direction: Literal["add", "remove"]
    quantity: int = Field(gt=0, le=100_000)
    reason: Literal["Damaged", "Expired", "Lost or missing", "Counted differently"]


class StockEntryOut(BaseModel):
    """One correction or adjustment from the stock_entries history."""

    id: int
    kind: Literal["correction", "adjustment"]
    product_id: int
    product: str
    delivery_id: int | None  # set only for corrections
    quantity_change: int
    reason: str
    by: str
    at: datetime


class AdjustmentOut(StockEntryOut):
    """The answer to POST /products/{id}/adjustments: also the stock before and after."""

    before: int
    after: int
