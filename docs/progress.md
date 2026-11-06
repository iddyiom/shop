# Progress Tracker

The project's memory. Read this at the start of every session.
Update it at the end of every unit: move the unit, add decisions, set "Next".

## Current phase
Phase 4: React front end (plan: docs/frontend-plan.md). Phase 3, the API, is complete (units 1-9 below).

## In progress
(nothing)

## Next
Unit F10: Users screen (list, unlock, add, deactivate / reactivate). Write `docs/specs/f10-users.md` first.

## Units

| # | Unit | Status | Commit |
|---|---|---|---|
| 1 | Project setup: FastAPI hello world, health check | Done | 8fe2c04 |
| 2 | Database models (all 9 tables), test setup, password hashing | Done | 083e258 |
| 3 | Auth: login, lockout after 3 tries, roles, owner manages users | Done | d663588 |
| 4 | Sales: POST/GET /sales, receipts, list by day, `create-owner` command | Done | 1ef37df |
| 5 | Items and sub-items: /groups, /products, prices, price history, stop / bring back | Done | 55654f4 |
| 6 | Deliveries: POST/GET /deliveries, owner-only buying price, corrections | Done | 4f20e56 |
| 7 | Store balance and adjustments: /stock, /stock/low, adjustments, /stock-entries | Done | 4c9d96c |
| 8 | Home summary: GET /summary/today | Done | 75e2514 |
| 9 | Alembic migrations (must be done before switching to PostgreSQL) | Done | cb2e49d |

### Phase 4: front end (details in docs/frontend-plan.md)

| # | Unit | Status | Commit |
|---|---|---|---|
| F1 | Setup: Vite + React + TypeScript in `frontend/`, dev proxy, theme colors, first test | Done | 4c93a08 |
| F2 | App shell: menu, top bar, light/dark switch, routes | Done | 01837e9 |
| F3 | Log in and auth: api.ts, login, locked account, log out, menu by role | Done | 8f30727 |
| D1 | Demo accounts and one-click log in (development only) | Done | 0e6bb2c |
| F4 | Home for owner and shopkeeper | Done | 0ead0a8 |
| F8 | Items and prices, add or edit item, price change (moved first) | Done | 0ead0a8 |
| F6 | Receive stock (moved before F5) | Done | a75b0bf |
| F5 | New sale and receipt | Done | 6c77b75 |
| F7 | Store balance and adjust stock | Done | 087a479 |
| F9 | Sales records, restock history and corrections | Done | 12c961e |
| B1 | Backend: `PATCH /users/{id}` (rename, deactivate) | Done | (not committed yet) |
| B2 | Backend: `GET /sales?from=&to=` date range | Parked (Version 2, with reports) | |
| F10 | Users: list, unlock, add, deactivate | Next | |

Statuses: Planned, Next, In progress, Done, Parked.

## Decisions made (newest first)
Short notes on choices that are not obvious from the docs, so nobody undoes them by accident.

- 2026-11-06: Unit B1: `PATCH /users/{id}` changes only `full_name` and `is_active`; any other field (role, username, password) is refused with 422 (`extra="forbid"`), so the owner never thinks a role changed when it did not. The owner cannot deactivate their own account (409 `cannot_deactivate_self`); another owner can. Reactivating does not unlock (Unlock stays its own action). No new code was needed to make deactivation work at once: `CurrentUser` and login already refuse inactive users, and tests now prove it. Rules live in the new `app/services/users.py`; create, list and unlock stay in the router (not moved in this unit). `Name` moved to the top of app/schemas.py so the users section can use it.
- 2026-11-06: Noticed (not built): the owner cannot reset a forgotten password from the app; only the terminal can help. Worth its own small unit.
- 2026-11-05: Unit F9: "This week" dropped and B2 parked with the reports (Version 2); Sales records shows one day: Today, Yesterday (worked out from the server's date with `dayBefore`, in UTC so no time zone can shift it) or the date picker. The day is in the address (`/sales?day=`); a future or broken day is never sent to the API. The owner's day total adds up the server's own receipt totals; shopkeepers see receipts and their totals but not the day total. A test fakes the laptop clock to a different day to prove the server's date wins (the first version of the tests could not tell, because the laptop and the fake server had the same date). Restock history: each delivery has its own address (`/restock/:id`); the delivery's lines are never changed on screen, corrections show as a column and a list; the owner corrects with Add / Remove + a number + a required reason (the screen sends one signed number). Same sub-item twice on the paperwork is added together in the table. The list keeps showing while it reloads after a correction (found in the browser: the whole page had blanked and rebuilt the form). On phones the Corrections column hides so Recorded now fits. `signed` moved to format.ts.
- 2026-11-05: Unit F7: Store balance loads `/stock?include_stopped=true` once and filters on the screen (search, item chips, Show stopped, and the OUT / LOW / OK counts, which are also filters). The counts are counted after search, chip and stopped but before the status filter, so they always match what the table can show. Shopkeepers never ask `/stock-entries`. Adjust (`/stock/:id/adjust`, owner only, stopped sub-items too): direction and reason must both be chosen; choosing Add locks Damaged / Expired / Lost and drops one already chosen; "Only N in store" is checked on screen and again by the server (409 → message + reload). After saving, back to Store balance with a note built from the server's before / after (a test makes the server answer different numbers from the preview to prove it). On phones the Item column hides so the Adjust button fits. Checked on a throwaway API: remove 2 Damaged, add 1 Counted differently, a real 409 race, shopkeeper view, dark mode, phone width.
- 2026-11-05: Unit F5: the sale request carries only product_id, quantity and payment_method (checked in the real browser); totals on screen are a preview and the receipt shows the server's numbers, with a note when a price changed while the page was open. Stock is checked on screen and again by the server; a server 409 is shown on its line (ApiError now keeps the error's extra fields, e.g. product_id) and the cards reload. Payment must be chosen each time. The unfinished bill (ids and quantities only) is kept in sessionStorage for the tab and cleared after the sale, by Clear, or at log out. Receipt has its own address (/receipt/:id). Bill logic lives in bill.ts as plain functions.
- 2026-11-05: Front-end tests got random timeouts on a busy laptop (findBy gives up after 1 s by default). tests/setup.ts raises it to 5 s and vite.config.ts sets testTimeout 20 s; one test that checked a reload instantly now waits for it. Three full runs green afterwards.
- 2026-11-05: Bug found in the browser and fixed: bill changes used a stale copy (setBill(addProduct(bill, id))), so fast clicks overwrote each other. All bill changes now use React's updater form (setBill(current => ...)); a test reproduces it with three clicks in one batch and fails on the old code.
- 2026-11-05: Unit F6: the delivery date uses the browser's own date picker, starting on the server's today with max = today. The default is worked out on every draw (pickedDate ?? today), not copied in a useEffect: the effect left a moment with an empty date (a timing race the full test run exposed). Shopkeepers have no buying price column at all and never send the field. The "3 → 51" preview is only a preview; after saving, stock is reloaded from the API. A refused save keeps the form. Tested on a throwaway API for both roles, yesterday's date, and the server refusing a future date.
- 2026-11-05: Unit F8: every price change (item or sub-item) goes through PriceConfirm (old → new, affected sub-items, "old receipts keep"); nothing is sent until Yes, change. Forms send only changed fields; a sub-item edit that changes the price sends the PATCH (if any) and then the PUT after confirm. No Delete anywhere: stop / bring back only. Stopped items behind a Show stopped switch. Pages: /items, /items/new, /items/:id/edit, /items/:id/new-sub-item, /items/sub-items/:id/edit. api.ts gained apiPatch and apiPut; money.ts parses TSh and levels (the server still decides). Tested end to end on a throwaway API; depot.db kept empty for Iddy's real items.
- 2026-11-05: Order changed again to F8 → F6 → F5: with a clean database there are no items, and a delivery or sale needs items to choose from.
- 2026-11-05: Iddy: screens must show real counts only. The local depot.db was cleared (example items and test sales removed; backup kept outside the repo), only the demo log ins remain. F6 Receive stock comes before F5 New sale, so real stock enters first. "Calendar" = a date picker on screens (the browser's built-in `<input type="date">`, offline, no outside service): delivery date in F6, day choice in F9. No outside calendar service.
- 2026-11-05: Unit F4: Home reads /summary/today, /stock/low and /sales?day=<the summary's date> (the server decides "today"). Times and dates are read as text (no browser time-zone conversion). The money card exists only if the API sends sales_total. Shopkeepers see "Latest sales" (everyone's receipts), not "My receipts" (seller names are not unique). useApi(path) and Panel handle loading / error / Try again per panel. CSS: the shell uses overflow-x: clip, not hidden (hidden let the browser scroll the box 200px and hide the menu); long table text is cut with … so totals always fit.
- 2026-11-05: Unit D1: demo accounts (demo_owner, demo_shop) live in frontend/dev-accounts.json. `python -m app.manage add-demo-users` creates or resets them and refuses any non-SQLite database. The Log in page shows one-click buttons only under `npm run dev`: DemoLogin is loaded with `import.meta.env.DEV ? lazy(...) : null`, so the build contains no demo password (checked by searching dist/, and the search was proven by removing the guard). No sign up page, by design.
- 2026-11-05: Unit F3: token only in sessionStorage (`depot-token`); the user and role are never stored in the browser, they come from GET /auth/me. api.ts adds the Bearer token to every call; any 401 or 423 (except from /auth/login) clears it and returns to Log in. After log in you land on the page you wanted. Shopkeepers typing an owner address see an Owner only page. A new log in try clears the old "session ended" note (found by a test that first failed to catch a broken rule).
- 2026-11-05: Known gap (accepted for Version 1): log out only makes the browser forget the token; the token stays valid on the server until it expires (12 hours). Fix with deployment (token version per user or blocklist).
- 2026-11-05: Noticed (not built): the login message says "1 tries remaining"; should be "1 try remaining" (app/routers/auth.py).
- 2026-11-05: Unit F2: one address per screen (routes.tsx); every page except /login sits in Layout (menu, top bar). The menu list and its roles live only in menu.ts; New sale is never in the menu. Theme remembered per browser in localStorage (`depot-theme`), applied before the first draw; broken storage falls back to light. Until F3 the user is a fixed owner from `useCurrentUser()` in user.ts. The F1 card is now the API pill in the top bar. Lesson: restart `npm run dev` after `npm install`, or Vite can load two copies of React ("Invalid hook call").
- 2026-11-05: Unit F1: front end set up by hand in `frontend/` (no template). Exact versions (React 19.3.1, Vite 8.3.6, TypeScript 7.0.2, Vitest 5.1.0), lockfile committed. Vite forwards `/api` to 127.0.0.1:8000 and strips the prefix. Fonts bundled (@fontsource) so the app works offline. Colors only as CSS variables in theme.css; light by default until F2's switch. Note: on Windows the dev server answers on `localhost` (IPv6), not 127.0.0.1.
- 2026-11-05: Phase 4 plan agreed: TypeScript, plain CSS with theme variables (light = Sage, dark = Deep Blue), login token in sessionStorage, code in `frontend/` in this repo. Vite, React Router, plain fetch in one `api.ts`, Vitest. In development Vite forwards `/api` to FastAPI, so no CORS yet. The designs found two backend gaps: B1 (`PATCH /users/{id}`) and B2 (sales date range).
- 2026-11-05: Laptop redesign done as a design canvas (13 screens, light and dark). "New sale" is a big button on the home screens, not a menu item.
- 2026-11-05: Unit 9: tables are created and changed only by Alembic (`migrations/`, first revision bdc11083e66f). The server does not migrate on start; run `alembic upgrade head` deliberately. The database address comes from app/config.py, never alembic.ini. Unnamed constraints get names from NAMING_CONVENTION (no "ck" pattern: our CHECKs are named by hand). Migrations run with SQLite foreign-key checks off and batch mode on. The practice depot.db was rebuilt from the migration.
- 2026-11-05: Unit 8: home summary is today only (depot time). Items sold = units; low-stock count reuses `list_low_stock` (LOW + OUT, active), so it always matches /stock/low; last restock = latest `delivered_at`. Totals are summed by the database. `sales_total` is owner-only via a separate schema.
- 2026-11-05: Unit 7: corrections and adjustments share `change_stock` in `app/services/stock.py` (database-side add, guarded removal). Sales keep their own update because their errors differ.
- 2026-11-05: Unit 7: adjustment reasons are exactly Damaged, Expired, Lost or missing, Counted differently. Only Counted differently can add. Stopped sub-items are hidden from /stock unless asked and never in /stock/low, but can still be adjusted. `/stock` uses `?group_id=` (API plan updated).
- 2026-11-05: Unit 6: stock goes up with a database-side add (`stock = stock + n`) so a sale at the same moment is never overwritten. A shopkeeper who sends a buying price gets 403 (not silently dropped). Shopkeeper responses use a schema with no `buying_price` key at all.
- 2026-11-05: Unit 6: a correction only fixes a sub-item that is on that delivery; the line's net quantity and the stock can never go below 0. Delivery date defaults to today, past allowed, future refused. The same sub-item twice stays two lines.
- 2026-11-05: Noticed (not built): there is no way to fix a wrong buying price. Decide in a later unit (history is never edited).
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
Backend: 117 tests passing (last run 2026-11-06). Front end: 135 tests passing (last run 2026-11-05).
