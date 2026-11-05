# Front-end Plan (Phase 4)

The React front end for the depot API. Built the same way as the API: one unit at a time, spec first.
Designs: "Depot laptop redesign" canvas, https://claude.ai/artifact/WkSjbsigXCS5q2WFJhr7tk (private to Iddy).
13 screens, each in light mode (Sage) and dark mode (Deep Blue).

## 1. Decisions (agreed with Iddy, 2026-11-05)

| Question | Choice | Why |
|---|---|---|
| Language | TypeScript | Types work like Pydantic schemas: the editor catches a wrong field name before the page breaks |
| Styling | Plain CSS with theme variables | One variable per color (`--page`, `--accent`...), swapped for dark mode. Matches the THEMES lists in the designs 1:1 |
| Login token | `sessionStorage` | Works with the API as it is; cleared when the tab closes, so a shared depot laptop does not stay logged in |
| Where | `frontend/` folder in this repo | One repo, one history; an API change and its screen can be one commit |

Chosen by Claude (small, standard, easy to change):

| Job | Tool | Why |
|---|---|---|
| Build and dev server | Vite | Fast, the standard way to start React today |
| Pages and links | React Router | The standard router; one URL per screen |
| Calling the API | Plain `fetch` in one small file | Learn what is underneath before adding a library |
| Tests | Vitest + React Testing Library | Vitest is Vite's test runner; Testing Library tests what the user sees |

New libraries in total: `react`, `react-dom`, `react-router`, `typescript`, `vite`, `vitest`, `@testing-library/react`, `jsdom`. Versions are pinned by `package-lock.json` (committed), like `requirements.txt` on the backend.

## 2. How the front end talks to the API

```
Browser (React, port 5173)  --/api/sales-->  Vite dev server  --/sales-->  FastAPI (port 8000)
```

- In development, Vite forwards every `/api/...` request to FastAPI. The browser only ever talks to one address, so no CORS setup is needed yet. (Production hosting is decided in the deployment phase.)
- One file, `frontend/src/api.ts`, makes every call: it adds the `Authorization: Bearer <token>` header, turns JSON into data, and turns API errors (`{"error", "message"}`) into one `ApiError` type.
- The screen shows the API's `message` text as it is. The designs already use the exact API sentences ("Item over: only 4 in store").

## 3. Rules that must never break (front end)

1. **The screen never decides what is true.** Totals on the sale screen are a preview; the receipt shown after saving comes from the server's answer. (Same rule as CLAUDE.md: never trust the screen.)
2. **Hiding is not security.** Owner-only menus and fields are hidden for shopkeepers for a clean screen, but the server is what refuses them (403). Never rely on the front end to protect anything.
3. **No raw HTML from data.** Never use `dangerouslySetInnerHTML`. React escapes text by default; that is what keeps the token in `sessionStorage` safe from injected scripts.
4. **401 means log in again.** Any 401 from the API clears the token and returns to the login screen. 423 shows the "account locked" message.
5. **The token is never put in a URL, a log, or `localStorage`.**

## 4. Folder layout

```
frontend/
  index.html
  package.json, package-lock.json, tsconfig.json, vite.config.ts
  src/
    main.tsx            starts React, sets up the router
    api.ts              the only place that calls fetch
    auth.tsx            who is logged in (token, user, role), login and logout
    theme.css           color variables for light and dark
    types.ts            TypeScript shapes of the API's JSON (mirrors app/schemas.py)
    components/         shared pieces: Layout (menu + top bar), Badge, ThemeSwitch...
    pages/              one file per screen: Login.tsx, Home.tsx, Sale.tsx...
  tests/                Vitest tests
```

## 5. Units

| # | Unit | Screens from the design | API used |
|---|---|---|---|
| F1 | Setup: Vite + React + TypeScript in `frontend/`, dev proxy, theme colors, first test | (none) | `/health` |
| F2 | App shell: menu, top bar, light/dark switch, routes with empty pages | layout of every screen | (none) |
| F3 | Log in and auth: `api.ts`, login, wrong password and locked messages, log out, protected pages, menu by role | Log in | `/auth/login`, `/auth/me` |
| F4 | Home for owner and shopkeeper | Owner home, Shopkeeper home | `/summary/today`, `/stock/low`, `/sales?day=` |
| F6 | Receive stock (built after F8, before F5) | Receive stock | `/products`, `/deliveries` |
| F5 | New sale and receipt | New sale, Receipt | `/products`, `/sales` |
| F7 | Store balance and adjust stock | Store balance, Adjust stock | `/stock`, `/stock/low`, `/stock-entries`, `/products/{id}/adjustments` |
| F8 | Items and prices, add or edit item, price change confirm, price history (built first of the screens) | Items and prices, Add or edit item | `/groups`, `/products`, the `/price` endpoints |
| F9 | Sales records, restock history and corrections | Sales records, Restock history | `/sales`, `/deliveries`, `/deliveries/{id}/corrections` |
| F10 | Users: list, unlock, add, deactivate | Users | `/users`, `/users/{id}/unlock`, `PATCH /users/{id}` |

### Backend gaps found by the designs (each a small backend unit, with its own spec)
| # | Unit | Needed before |
|---|---|---|
| B1 | `PATCH /users/{id}`: rename, deactivate (in the API plan, not built in unit 3) | F10 |
| B2 | `GET /sales?from=&to=`: a date range, for "This week" | F9 (or drop "This week" from the design) |

## 6. How each unit is built
Same as the API (docs/ai-workflow.md): a spec in `docs/specs/` first (`f01-setup.md`, `f02-shell.md`...), agreed by Iddy, then build only that, tests green, commit, update docs/progress.md.
Front-end definition of done adds: works in light and dark mode, works at phone width (menu stacks), every button reachable with the keyboard, and no `dangerouslySetInnerHTML`.

## 7. Running it (after F1)
Two terminals:
- API: `.venv\Scripts\activate`, `alembic upgrade head`, `uvicorn app.main:app --reload`
- Front end: `cd frontend`, `npm install` (first time), `npm run dev`, then open http://localhost:5173
Tests: `npm test` inside `frontend/`.
