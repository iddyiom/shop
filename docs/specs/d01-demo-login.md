# Unit D1: Demo accounts and quick log in (development only)

Status: Done (2026-11-05). Iddy chose: only on the laptop, no sign up, one click logs in. Also needed: "resolveJsonModule" in frontend/tsconfig.json to import the JSON file.
Depends on: F3 (log in), backend unit 3 (users), `app/manage.py`.

## 1. Goal
Testing every screen as owner and as shopkeeper takes one click. A terminal command creates two demo accounts in the local database, and the Log in page, only while running `npm run dev`, shows "Owner" and "Shopkeeper" buttons that log straight in.
User stories covered: none (a developer tool). It must not weaken story #1 (only authorized people use the system).

## 2. Out of scope
- A Sign up page. By design only the owner creates accounts (Users page, F10). No change.
- Demo data such as items and sales (`add-example-data` already exists).
- Showing demo accounts in the built app the depot uses.

## 3. What you will see
- Terminal: `python -m app.manage add-demo-users` prints "Demo accounts ready: demo_owner (owner), demo_shop (shopkeeper)".
- Log in page under `npm run dev`: a box "Demo accounts · only on this laptop" with two buttons, **Owner** and **Shopkeeper**, each showing its username. One click logs in.
- Log in page in the built app (`npm run build`): no box, and the demo passwords are nowhere in the files.

## 4. Rules and design decisions
1. **One source of truth:** `frontend/dev-accounts.json` holds the demo usernames, names, roles and passwords. The backend command and the Log in page both read it.
2. **Development only in the front end:** the demo box is a separate component loaded only when `import.meta.env.DEV` is true. Vite removes it, and the JSON with it, from the production build. Checked by searching `dist/` for the demo passwords: must find nothing.
3. **Local database only in the backend:** `add-demo-users` refuses to run unless the database is a local SQLite file. *Why: an owner account with a password written in Git must never reach a real (PostgreSQL) server.*
4. **Running it again resets the demo accounts:** password back to the file's value, unlocked, failed tries 0, active. *Why: testing lockout locks the demo shopkeeper; one command fixes it.* Other accounts are never touched.
5. **Passwords are stored hashed** like every account (CLAUDE.md rule). Only the JSON file has them in plain text, and it is a development file.
6. **No sign up.**
7. **One click = one try:** the buttons use the same `logIn()` as the form, are disabled while logging in, and show the API's message if it fails (e.g. "Run: python -m app.manage add-demo-users" hint when the demo account does not exist yet: the API says "Wrong username or password", and the box adds the hint).

## 5. Implementation
| File | Change |
|---|---|
| `frontend/dev-accounts.json` (new) | The two demo accounts (rule 1) |
| `app/manage.py` | `add-demo-users` command (rules 3, 4, 5) |
| `frontend/src/components/DemoLogin.tsx` (new) | The demo box and buttons (rule 7) |
| `frontend/src/pages/Login.tsx` | Loads `DemoLogin` only in development (rule 2) |
| `frontend/src/theme.css` | Demo box styles |
| `tests/test_manage.py` (new) | Backend tests below |
| `frontend/tests/demo.test.tsx` (new) | Front-end tests below |
| `CLAUDE.md` | Run line: `python -m app.manage add-demo-users` |

## 6. Tests
Backend (`tests/test_manage.py`)
- `add_demo_users_creates_owner_and_shopkeeper_with_hashed_passwords`
- `running_again_resets_password_and_unlocks`
- `refuses_when_database_is_not_local_sqlite`
- `other_users_are_not_touched`
Front end (`frontend/tests/demo.test.tsx`)
- `log in page shows the demo box in development`
- `clicking Owner logs in as the demo owner`
- `a failed demo log in shows the API message and the add-demo-users hint`
Build check (manual, in the done checklist): `dist/` contains no demo password.

## 7. Done checklist
- [ ] `add-demo-users` works on the local database and refuses a non-SQLite URL.
- [ ] One click logs in as owner and as shopkeeper (real API).
- [ ] `npm run build`, then searching `dist/` for the demo passwords finds nothing.
- [ ] `pytest`, `npm test`, `npm run build` green.
- [ ] docs/progress.md updated.
