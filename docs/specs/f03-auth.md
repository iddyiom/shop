# Unit F3: Log in and auth

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: F2 (shell, menu by role, `useCurrentUser()`), backend unit 3 (`/auth/login`, `/auth/me`, lockout).

## 1. Goal
People really log in. The login form talks to the API, shows its exact messages (wrong password with tries left, account locked), and keeps the token for the visit. Every page except Log in needs a logged-in user. The menu, the user card and "Habari, …" show the real person and role. Log out ends the visit.
User stories covered (docs/requirements.md section 5): #1 (log in so only authorized people use the system), and the lockout rule from section 7.

## 2. Out of scope for this unit
- Data on any page (F4 onwards).
- Unlocking accounts and managing users (F10).
- Changing your own password (not in Version 1).
- Ending the token on the server at log out (see question 3).
- Different Home screens for owner and shopkeeper (F4; until then both see the same empty Home).

## 3. API used
| Call | When | Answers the screen must handle |
|---|---|---|
| `POST /auth/login` `{username, password}` | Log in button | 200 `{access_token, user}`; 401 "Wrong username or password" or "Wrong username or password. N tries remaining"; 423 "Account locked. Ask the owner to unlock it." |
| `GET /auth/me` (with token) | App opens and a token is already saved | 200 the user; 401 token expired or fake; 423 account was locked |

## 4. Rules and design decisions
1. **The token lives only in `sessionStorage`** (key `depot-token`), as agreed in the plan. Never `localStorage`, never in a URL, never logged. It is gone when the tab closes.
2. **The user and role are never stored in the browser.** When the app opens with a saved token, it asks `GET /auth/me` who this is. *Why: anything in browser storage can be edited by hand. If the role were stored, anyone could type "owner" into it. The server's answer is the only truth.* (Even then the server re-checks every call.)
3. **`api.ts` adds `Authorization: Bearer <token>`** to every call, in one place. It gains `apiPost` next to `apiGet`.
4. **Any 401 from any call ends the visit:** token cleared, back to Log in, with the message "Your session ended. Please log in again." Exception: a 401 from `/auth/login` itself is just a wrong password.
5. **A 423 anywhere** (locked while logged in) also ends the visit and shows the locked message on the Log in page.
6. **Protected pages:** with no token, any page sends you to `/login`. After logging in you land on the page you wanted (question 1).
7. **Owner-only pages** (`/items`, `/users`): a shopkeeper who types the address sees an "Owner only" page, not the content (question 2). The menu already hides them. The server's 403 is still the real lock.
8. **The login form:** username and password fields with labels, `autocomplete="username"` and `"current-password"`. The button shows "Logging in…" and is disabled while waiting, so one click sends one request. The API's message is shown as is (it already says how many tries remain). After a failed try the password field is emptied; the username stays.
9. **The password is never kept** after the request: not in state, storage or logs.
10. **Already logged in** and you open `/login`: you are sent Home.
11. **While the app checks a saved token** (`/auth/me`), it shows "Loading…" instead of flashing the Log in page.
12. **Log out** clears the token and the user and goes to Log in.

## 5. Implementation
| File | Change |
|---|---|
| `frontend/src/types.ts` (new) | `User` and `LoginResponse` shapes, matching `UserOut` and `LoginResponse` in app/schemas.py |
| `frontend/src/api.ts` | Token read/save/clear (`sessionStorage`), the Authorization header, `apiPost`, a hook for "401 happened" (rules 3, 4) |
| `frontend/src/auth.tsx` (new) | `AuthProvider` and `useAuth()`: the current user, `logIn()`, `logOut()`, checking a saved token at start (rules 2, 5, 11, 12) |
| `frontend/src/user.ts` | `useCurrentUser()` now reads the real user from `useAuth()` (types and role labels stay) |
| `frontend/src/components/RequireAuth.tsx` (new) | Sends visitors without a user to `/login`, remembering where they wanted to go (rule 6) |
| `frontend/src/components/RequireOwner.tsx` (new) | Shows the Owner only page to shopkeepers (rule 7) |
| `frontend/src/pages/Login.tsx` | The real form (rule 8), the session-ended and locked messages |
| `frontend/src/pages/OwnerOnly.tsx` (new) | "This page is for the owner" with a link Home |
| `frontend/src/components/Layout.tsx` | "Log out" becomes a button that calls `logOut()` |
| `frontend/src/routes.tsx` | Wrap pages in `AuthProvider`, `RequireAuth`, `RequireOwner` |
| `frontend/src/theme.css` | Login form, error box, loading styles |
| `frontend/tests/auth.test.tsx` (new) | Tests below; `shell.test.tsx` updated to log in a fake user first |

No backend change.

## 6. Front-end rules touched (docs/frontend-plan.md section 3)
- **Rule 2, hiding is not security:** Owner only page and hidden menu entries are for a clean screen; the server's 403 decides.
- **Rule 4, 401 means log in again:** built here.
- **Rule 5, the token:** `sessionStorage` only; tested.

## 7. Tests
`frontend/tests/auth.test.tsx` (fetch is faked)
- `logging in saves the token in sessionStorage, not localStorage, and opens Home`
- `menu and user card show the real user and role after log in`
- `wrong password shows the API's message with tries remaining and empties the password`
- `locked account shows the locked message`
- `cannot reach the API shows "Cannot reach the API"`
- `button says Logging in… and is disabled while waiting`
- `every call sends Authorization: Bearer <token>`
- `a 401 from any call clears the token and returns to Log in with "Your session ended"`
- `a 401 from /auth/login does not end anything; it is a wrong password`
- `no token: opening /stock goes to Log in, and after logging in lands on /stock`
- `saved token: the app asks /auth/me and shows Loading… first`
- `saved token for a shopkeeper: shopkeeper menu`
- `shopkeeper opening /users sees Owner only`
- `log out clears the token and returns to Log in`
- `logged-in user opening /login is sent Home`

## 8. Done checklist
- [ ] Log in works against the real API (with the owner from `python -m app.manage create-owner`), for owner and shopkeeper.
- [ ] Wrong password shows tries left; the 3rd wrong try shows locked (real API).
- [ ] Token only in `sessionStorage`; nothing about the user or role stored in the browser.
- [ ] Every test in section 7 passes; `npm run build` green; backend `pytest` still 102.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (F3 Done, decisions, Next = F4, test counts).

## 9. Open questions (answered: all four recommendations accepted)
1. **After logging in, where do people land?** Always Home, or the page they tried to open?
   Recommendation: the page they tried to open (rule 6). If the session ends while the owner is on Store balance, logging in again brings them straight back.
2. **A shopkeeper types `/users`:** show an "Owner only" page, or quietly send them Home?
   Recommendation: an "Owner only" page. A clear message beats a page that silently jumps; it also makes testing easy.
3. **Log out and the server.** Our tokens are signed and last 12 hours; the API has no "log out" call, so a copied token keeps working until it expires, even after log out. Accept this for Version 1, or add a backend unit now (e.g. a token version per user that log out increases)?
   Recommendation: accept for Version 1 and write it in docs/architecture.md "Known gaps". The token never leaves the tab, the tab forgets it, and 12 hours is one working day. A backend unit can come with deployment, when the app is on a network.
4. **One login per tab.** `sessionStorage` is per tab, so opening the app in a second tab asks for log in again. OK?
   Recommendation: yes. It is the price of not staying logged in on a shared depot laptop, and the depot works in one tab.
