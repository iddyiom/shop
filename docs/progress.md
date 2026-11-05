# Progress Tracker

The project's memory. Read this at the start of every session.
Update it at the end of every unit: move the unit, add decisions, set "Next".

## Current phase
Phase 3: Coding (building the API, one unit at a time).

## In progress
(nothing)

## Next
Unit 6: Deliveries (write `docs/specs/06-deliveries.md` first).

## Units

| # | Unit | Status | Commit |
|---|---|---|---|
| 1 | Project setup: FastAPI hello world, health check | Done | 8fe2c04 |
| 2 | Database models (all 9 tables), test setup, password hashing | Done | 083e258 |
| 3 | Auth: login, lockout after 3 tries, roles, owner manages users | Done | d663588 |
| 4 | Sales: POST/GET /sales, receipts, list by day, `create-owner` command | Done | 1ef37df |
| 5 | Items and sub-items: /groups, /products, prices, price history, stop / bring back | Done | 55654f4 |
| 6 | Deliveries: POST/GET /deliveries, owner-only buying price, corrections | Planned | |
| 7 | Store balance and adjustments: /stock, /stock/low, adjustments, /stock-entries | Planned | |
| 8 | Home summary: GET /summary/today | Planned | |
| 9 | Alembic migrations (must be done before switching to PostgreSQL) | Planned | |

Statuses: Planned, Next, In progress, Done.

## Decisions made (newest first)
Short notes on choices that are not obvious from the docs, so nobody undoes them by accident.

- 2026-11-05: Unit 5: prices change only through the `/price` endpoints, so every change (including the first price) writes price_history. Same price again = no row. Lists hide stopped items unless `?include_stopped=true`. An item's price history includes its sub-items' own-price changes.
- 2026-11-05: Unit 5: names are unique ignoring upper/lower case (checked in the service). If two requests race past the check, the database unique constraint refuses one and the service answers 409, not 500.
- 2026-11-05: Keep the current stack (FastAPI, SQLAlchemy, own auth). No Clerk, Liveblocks or Trigger.dev: the depot has no live shared canvas, no long background jobs, and auth with lockout is already built and tested.
- 2026-11-05: Wrote docs/architecture.md. Every invariant lists where it is enforced and which test proves it. Known gap: login rules live in the auth router, move to a service when auth is next touched.
- 2026-11-05: Wrote docs/ai-workflow.md: no code before an agreed spec, no new tools without asking, one definition of done for every unit.
- 2026-11-05: Wrote docs/code-standards.md from the patterns units 1-4 already use (routers thin, rules in services, AppError, insert-only history).
- 2026-11-05: Adopted spec-driven development: one spec file per unit in `docs/specs/`, each with a "done" checklist.
- 2026-11-05: Sale stock is reduced with a guarded update ("take N only if at least N remain") so two sales at the same moment cannot push stock below 0.
- 2026-11-05: Business rules live in `app/services/`, not in routers, so they are easy to read and test.

## Test status
52 tests passing (last run 2026-11-05).
