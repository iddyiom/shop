# Architecture

The blueprint: which tools we use and why, how a request flows through the code,
and the rules the system must never break (with where each one is enforced).
Tables are in docs/database-design.md. Endpoints are in docs/api-plan.md. Code style is in docs/code-standards.md.

## 1. Tech stack (each tool has one job)

| Job | Tool | Why this one |
|---|---|---|
| Web API | FastAPI | Checks input automatically, makes API docs at `/docs`, simple to learn |
| Input / output shapes | Pydantic (comes with FastAPI) | Bad input is refused with 422 before our code runs |
| Database access | SQLAlchemy 2 | Same Python code works on SQLite and PostgreSQL |
| Database | SQLite now, PostgreSQL before deployment | SQLite needs no setup on a laptop; PostgreSQL handles many users on a server |
| Passwords | bcrypt | Slow one-way hash with salt; the plain password is never stored |
| Login tokens | PyJWT (signed tokens, 12 hours) | The server can check a token without storing sessions |
| Tests | pytest + FastAPI TestClient | Each test gets a fresh in-memory database |
| Front end | React (later phase) | |
| Migrations | Alembic 1.20 (`migrations/`) | Change tables safely without losing data; one numbered script per change, kept in Git |

Not used, on purpose: hosted login services (Clerk), real-time services (Liveblocks), background job services (Trigger.dev), file storage. See "Decisions made" in docs/progress.md.

## 2. The layers

```
 Screen (React later, /docs for now)
        |  HTTP + JSON, token in "Authorization: Bearer ..."
        v
 Router         app/routers/      reads the request, returns the response
        |  uses
        v
 Dependencies   app/deps.py       who is calling? DbSession, CurrentUser, OwnerUser
        |
        v
 Service        app/services/     the business rules: check, calculate, save
        |
        v
 Models         app/models.py     tables + constraints (the last line of defense)
        |
        v
 Database       SQLite file depot.db  (PostgreSQL later)
```

Boundaries:
- Routers never contain business rules. Services never know about HTTP.
- Only services (and simple routers with no rules, like listing users) write to the database.
- Every rule that the database can enforce is ALSO a database constraint, so even a bug in Python cannot break it.
- Everything the outside world sees passes through a `response_model` schema.

## 3. One request, step by step (POST /sales)

1. The screen sends the products and quantities only. No prices, no totals.
2. `CurrentUser` reads the token: logged in, active, not locked? Otherwise 401 or 423.
3. Pydantic checks the shape: quantity > 0, payment method is `cash` or `mobile_money`. Otherwise 422.
4. `record_sale` checks every line first: product exists, is active (and its item is active), enough stock. Otherwise 409, nothing saved.
5. Prices come from the database (`effective_price`). Totals are calculated by the server.
6. Stock is reduced with a guarded update ("only if at least N remain"), and the sale is saved, in one transaction. Any failure: rollback, nothing saved.
7. The receipt goes back through the `Receipt` schema.

Every unit that changes stock (deliveries, corrections, adjustments) follows the same shape: check all, then change all in one transaction.

## 4. Invariants (rules the system must never break)

| # | Invariant | Enforced by | Tested by |
|---|---|---|---|
| 1 | Stock never below 0 | DB constraint `ck_products_stock` + guarded update (sales; `change_stock` for corrections and adjustments) | `test_database_refuses_negative_stock`, `test_more_than_stock_is_item_over`, `test_adjustment_cannot_push_stock_below_zero` |
| 2 | A sale (later: a delivery, a correction) is all or nothing | One transaction + rollback in the service | `test_sale_is_all_or_nothing`, `test_delivery_is_all_or_nothing` |
| 3 | The server calculates every price and total | Service reads prices from the DB; input schemas have no price fields | `test_server_ignores_prices_sent_by_the_screen` |
| 4 | A receipt keeps the price at the time of sale | `sale_items.unit_price` is a copy, never recalculated | `test_old_receipt_keeps_old_price` |
| 5 | History is never edited (sales, deliveries, price_history, stock_entries) | No update or delete code for these tables; changes are new rows | `test_set_own_price_then_remove_it`, `test_change_item_price_returns_old_and_new_and_adds_history` |
| 6 | Nothing is hard-deleted | `is_active` flags instead of delete | `test_stopped_sub_item_cannot_be_sold` |
| 7 | Owner-only actions are refused for shopkeepers | `OwnerUser` dependency on the endpoint | `test_shopkeeper_cannot_manage_users` |
| 8 | Owner-only fields (buying prices, money totals) never reach a shopkeeper | Separate response schemas per role (`DeliveryOut` / `DeliveryOwnerOut`, `SummaryOut` / `SummaryOwnerOut`); shopkeepers sending a buying price get 403 | `test_shopkeeper_never_sees_buying_price`, `test_shopkeeper_cannot_send_buying_price`, `test_shopkeeper_never_sees_sales_total` |
| 9 | Passwords are stored hashed | `hash_password` (bcrypt) on every create | `test_owner_creates_user_with_hashed_password` |
| 10 | 3 wrong passwords lock the account until the owner unlocks it | Login counts `failed_attempts`; `CurrentUser` refuses locked users | `test_third_wrong_password_locks_account`, `test_owner_unlocks_account` |
| 11 | The code runs on SQLite and PostgreSQL | No SQLite-only SQL; SQLite setup only inside `make_engine` | (checked when switching) |

A new unit that touches one of these rules must keep its test green and add tests for its own part.

## 5. Settings and secrets

| Setting | Environment variable | Default on a laptop |
|---|---|---|
| Database | `DEPOT_DATABASE_URL` | SQLite file `depot.db` in the project folder |
| Token secret | `DEPOT_SECRET_KEY` | Random key made once in the git-ignored `.secret_key` file |
| Time zone | (fixed) | East Africa Time, UTC+3 |

`depot.db`, `.secret_key` and `.env` are git-ignored and must never be committed.

## 6. Running things
- Server: `uvicorn app.main:app --reload`, then open `http://127.0.0.1:8000/docs`.
- Tests: `pytest`.
- Terminal commands (`app/manage.py`): `create-owner`, `unlock USERNAME`, `add-example-data`.
- Tables: `alembic upgrade head` creates or updates them (run it before the first start and after pulling new migrations). The server never creates tables itself. Tests build their own in-memory tables with `create_all`.
- After changing `app/models.py`: `alembic revision --autogenerate -m "what changed"`, review the file, `alembic upgrade head`.

## 7. Known gaps (to fix in their own unit, not by the way)
- Login rules (attempt counting, locking) live in `app/routers/auth.py`, not in a service. Move to `app/services/auth.py` when auth is next touched.
