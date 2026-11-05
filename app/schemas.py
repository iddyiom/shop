# The shape of the JSON that comes IN to the API and goes OUT of it.
# Pydantic checks incoming data and rejects bad input with a 422 error.
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.security import MAX_PASSWORD_BYTES

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
