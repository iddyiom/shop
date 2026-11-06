# Depot Management System: API Plan (Version 1)

## Basics
- Data format: JSON.
- Methods: GET (read), POST (create), PATCH (change part of something), PUT (replace a value).
- Every endpoint except login requires a logged-in user (token in the request header).
- Roles: `owner` can do everything. `shopkeeper` can sell, receive stock (quantities), and view stock.
- The server never trusts totals or prices sent by the screen. It recalculates everything.
- Owner-only fields (buying prices, money totals) are left out of responses for shopkeepers.

## Endpoints

### Authentication
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /auth/login | anyone | Username + password, get a token. Wrong password -> 401 with `attempts_remaining`. Locked -> 423 |
| GET | /auth/me | logged in | Who am I, what is my role |

### Users
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /users | owner | Create an account |
| GET | /users | owner | List users (shows locked ones) |
| PATCH | /users/{id} | owner | Rename (`full_name`), deactivate or reactivate (`is_active`). Cannot deactivate yourself (409). Other fields refused (422) |
| POST | /users/{id}/unlock | owner | Unlock a locked account |

### Items (product groups)
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | /groups | all | List items with price |
| POST | /groups | owner | Add an item |
| PATCH | /groups/{id} | owner | Rename, or stop / bring back |
| PUT | /groups/{id}/price | owner | Set new item price (adds price_history). Screen asks for confirmation first |
| GET | /groups/{id}/price-history | owner | Past prices |

### Sub-items (products)
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | /products | all | List sub-items with item, effective price, stock, status (OK, LOW, OUT) |
| POST | /products | owner | Add a sub-item (starts at 0 stock; optional own price) |
| PATCH | /products/{id} | owner | Rename, change low-stock level, stop selling (`is_active` false) or bring back (true) |
| PUT | /products/{id}/price | owner | Set own price, or send `null` to use the item price again |

### Deliveries (restocking)
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /deliveries | owner, shopkeeper | Record a restocking day. `buying_price` per line is accepted from the owner only |
| GET | /deliveries | all | Past deliveries |
| GET | /deliveries/{id} | all | One delivery with items (buying prices only for owner) |
| POST | /deliveries/{id}/corrections | owner | Correct a delivery line: product, signed quantity change, reason. Adds a stock entry |

### Sales
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /sales | owner, shopkeeper | Confirm a sale (checks stock, reduces stock, saves) |
| GET | /sales | all | List sales (filter by date) |
| GET | /sales/{id} | all | One sale = the receipt |

### Store balance and adjustments
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | /stock | all | Balance of every sub-item (supports `?group_id=`, `?search=` and `?include_stopped=true`) |
| GET | /stock/low | all | Only LOW and OUT items |
| POST | /products/{id}/adjustments | owner | Add or remove stock with a required reason (Damaged, Expired, Lost or missing, Counted differently) |
| GET | /stock-entries | owner | History of corrections and adjustments |

### Home summary
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | /summary/today | all | Items sold today, low-stock count, last restock date. Sales total in TSh only for owner |

## Example: confirm a sale

Request: POST /sales
```json
{
  "payment_method": "cash",
  "items": [
    { "product_id": 3, "quantity": 2 },
    { "product_id": 7, "quantity": 1 }
  ]
}
```

Success (201 Created), this is the receipt:
```json
{
  "id": 42,
  "sold_at": "2026-11-04T12:10:00",
  "sold_by": "Shopkeeper name",
  "payment_method": "cash",
  "items": [
    { "product": "Fanta", "quantity": 2, "unit_price": 1000, "line_total": 2000 },
    { "product": "Chocolate", "quantity": 1, "unit_price": 500, "line_total": 500 }
  ],
  "total": 2500
}
```

Failure, stock is 0:
```json
{ "error": "item_not_available", "message": "Item not available", "product_id": 3 }
```

Failure, more than what is left:
```json
{ "error": "item_over", "message": "Item over: only 1 in store", "product_id": 3, "available": 1 }
```

## Example: adjust stock

POST /products/3/adjustments
```json
{ "direction": "remove", "quantity": 2, "reason": "Damaged" }
```
Response (201): `{ "product": "Fanta", "before": 5, "after": 3, "reason": "Damaged", "by": "Owner name", "at": "2026-11-04T20:10:00" }`

## Error codes used
| Code | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 / 422 | Bad input (missing field, quantity 0, missing reason, unknown product) |
| 401 | Not logged in, or wrong username or password |
| 403 | Logged in but not allowed (e.g. shopkeeper changing a price) |
| 404 | Not found |
| 409 | Conflict (item not available, item over) |
| 423 | Account locked |

## How the screens map to endpoints
| Screen | Endpoints used |
|---|---|
| Login, wrong password | POST /auth/login |
| Home (owner / shopkeeper) | GET /summary/today |
| New sale | GET /products, then POST /sales (totals shown instantly, rechecked by the server) |
| Receipt | GET /sales/{id} |
| Items and prices, add item, edit sub-item | GET /groups, GET /products, POST /groups, POST /products, PATCH /products/{id}, PUT /groups/{id}/price, PUT /products/{id}/price |
| Confirm price change | PUT /groups/{id}/price or PUT /products/{id}/price |
| Receive stock (owner / shopkeeper) | GET /products, POST /deliveries |
| Correct a delivery | POST /deliveries/{id}/corrections |
| Store balance (owner / shopkeeper) | GET /stock, GET /stock/low |
| Adjust stock | POST /products/{id}/adjustments |
