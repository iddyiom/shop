# The shape of the JSON that comes IN to the API and goes OUT of it.
# Pydantic checks incoming data and rejects bad input with a 422 error.
from datetime import datetime
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
