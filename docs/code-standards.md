# Code Standards

How code is written in this project, so unit 9 looks like unit 1.
These rules describe what the existing code already does. Follow them in every new unit.
If a rule needs to change, change it here first, then in the code.

## 1. Where code goes (one job per file)

| Folder / file | Job | Example |
|---|---|---|
| `app/routers/<area>.py` | HTTP only: read the request, call a service, return the response | `routers/sales.py` |
| `app/services/<area>.py` | Business rules. No HTTP, no `Request`, no status codes except through `AppError` | `services/sales.py` |
| `app/models.py` | Tables. Database-level rules as constraints | `CheckConstraint("quantity_in_store >= 0")` |
| `app/schemas.py` | JSON shapes in and out (Pydantic). Grouped by area with `# ---------- Area ----------` | `SaleCreate`, `Receipt` |
| `app/deps.py` | Who is calling: `DbSession`, `CurrentUser`, `OwnerUser` | |
| `app/errors.py` | The one error type, `AppError` | |
| `app/config.py` | Settings, read from environment variables with safe defaults | `DEPOT_DATABASE_URL` |
| `tests/test_<area>.py` | Tests for one area | `tests/test_sales.py` |

Rule of thumb: if a router function is longer than about 10 lines, the rules probably belong in a service.

## 2. Routers

- One router per area: `router = APIRouter(prefix="/sales", tags=["sales"])`.
- Register it in `app/main.py`.
- Always set `response_model`. It decides exactly what goes out, so private fields (password hash, buying price for shopkeepers) can never leak by accident.
- Creating something returns `status_code=201`.
- Permissions come from dependencies, never from `if` checks inside the function:
  - anyone logged in: `user: CurrentUser`
  - owner only: `_owner: OwnerUser`
  - a dependency only needed for its check gets a leading underscore: `_user`, `_owner`.
- Paths are plural nouns, matching docs/api-plan.md exactly: `/sales`, `/groups/{group_id}/price`.

## 3. Services

- Plain functions that take `db: Session` and the acting `User` first: `record_sale(db, seller, request)`.
- **Check everything first, then change anything.** Validate every line, then write. Never half-save.
- One unit of work = one `db.commit()`. If anything fails, `db.rollback()` and raise.
- Prices and totals are calculated here from the database. Values sent by the screen are ignored.
- Stock changes use a guarded update (`... WHERE quantity_in_store >= n`) so two requests at once cannot push stock below 0.
- Helper functions used only inside the file start with `_`: `_merge_lines`.

## 4. Errors

- Raise `AppError(status, code, message, **extra)`. Never return error dicts by hand, never raise `HTTPException`.
- `code` is `snake_case` and stable (the front end will match on it): `item_over`, `owner_only`.
- `message` is the exact sentence the screen shows, copied from docs/requirements.md when it is written there.
- Status codes follow the table in docs/api-plan.md: 401 not logged in, 403 not allowed, 404 not found, 409 conflict, 422 bad input, 423 locked.

## 5. Models and the database

- SQLAlchemy 2 style: `Mapped[...]` and `mapped_column(...)`.
- Money is a whole number of TSh (`int`). Never `float`.
- Times use `now_local()` (East Africa Time) from `app/models.py`.
- Never hard-delete. Stopping something sets `is_active = False`.
- History tables (`sales`, `sale_items`, `deliveries`, `delivery_items`, `price_history`, `stock_entries`) are insert-only. No update or delete code for them.
- Name constraints: `ck_<table>_<what>`, `uq_<table>_<columns>`.
- **A model change always comes with a migration, in the same commit:** change `app/models.py`, run `alembic revision --autogenerate -m "what changed"`, read the new file in `migrations/versions/` by hand, run `alembic upgrade head`. `test_migrated_database_matches_models` fails if you forget.
- Constraints we do not name get a name from `NAMING_CONVENTION` in `app/database.py`. CHECK constraints are always named by hand.
- No SQLite-only features in app code (the app must also run on PostgreSQL). SQLite-specific setup stays inside `make_engine`.

## 6. Schemas

- Input schemas end in `Create` / `Update` (`SaleCreate`). Output schemas end in `Out`, or use a plain name for a document (`Receipt`).
- Validate at the edge with `Field(...)`: `quantity: int = Field(gt=0)`.
- Output schemas built from a row use `model_config = ConfigDict(from_attributes=True)`.
- Fixed choices use `Literal["cash", "mobile_money"]`.

## 7. Tests

- Every unit adds tests. A unit is not done until `pytest` is fully green.
- Turn each acceptance criterion in docs/requirements.md (section 10) into at least one test.
- Test names say the rule in plain words: `test_more_than_stock_is_item_over`.
- Always test the forbidden path too: a shopkeeper calling an owner-only endpoint gets 403.
- Use the fixtures in `tests/conftest.py` (`client`, `db`, `owner_headers`, `shopkeeper_headers`, `products`). Tests use an in-memory database and never touch `depot.db`.
- Check results in the database, not only in the response: `stock_of(db, product)`.

## 8. Style

- Names: `snake_case` for functions and variables, `PascalCase` for classes, `UPPER_CASE` for constants.
- Type hints on every function's arguments and return value.
- Each file starts with a one-line comment saying what it is for.
- Comments explain *why*, in simple English (this is a learning project): `# store the hash, never the password`.
- No secrets in code or in Git. They come from environment variables or git-ignored files.

## 9. Git

- One unit = one commit (or a few small ones), only with tests green.
- Commit message: `Area: what changed, in plain words`, e.g. `Sales: confirm sale in one transaction, receipts`.

## 10. Front end (`frontend/`, Phase 4)

| Folder / file | Job |
|---|---|
| `src/api.ts` | The ONLY place that calls `fetch`. Adds `/api`, reads JSON, turns error answers into `ApiError` |
| `src/theme.css` | Every color, as a CSS variable, for light (Sage) and dark (Deep Blue) |
| `src/pages/` | One file per screen (from F2) |
| `src/components/` | Shared pieces used by several pages (from F2) |
| `tests/` | Vitest tests; `fetch` is faked, the real API is never needed |

- TypeScript strict mode; no `any`. Type every API answer (e.g. `type Health = { status: string }`).
- Colors only as `var(--name)` from `theme.css`. No raw colors in components.
- Show the API's `message` as it is; do not invent different wording for the same error.
- Never `dangerouslySetInnerHTML`. Never put the token in a URL, a log or `localStorage`.
- Libraries are pinned exactly (`.npmrc` has `save-exact=true`); `package-lock.json` is committed.
- Every unit: `npm test` and `npm run build` green, and the backend's `pytest` still green.
