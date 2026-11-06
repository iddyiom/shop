# Unit F10: Users

Status: Draft
Depends on: F3 (auth, RequireOwner, api.ts), F4 (useApi, Panel), backend unit 3 (users, unlock) and B1 (`PATCH /users/{id}`).

## 1. Goal
The owner manages who can log in from the screen, without the terminal: sees every account and its state, unlocks a locked account, adds a new shopkeeper or owner, and deactivates someone who has left (or brings them back). Nothing is deleted.
User stories covered (docs/requirements.md section 5): #1 (only authorized people use the system). Permissions table: "Add users, unlock locked accounts" (owner only). Business rule: "The owner unlocks the account".

## 2. Out of scope for this unit
- Renaming a user (the API supports it since B1, but the design has no rename; see question 1).
- Changing a role, a username or a password; resetting a forgotten password (no API for it; noticed in B1).
- When the account was locked ("3 wrong passwords today at 08:15" in the design): the API does not record the time, so the banner says only who is locked.
- Deleting anything.

## 3. Page (from the design "Users")
| Address | Who | Page |
|---|---|---|
| `/users` | owner (shopkeepers get the Owner only page, F3) | **Locked banner** (only when someone is locked): "Asha Juma is locked out. Check it was really Asha, then unlock." + **Unlock Asha**. One banner per locked account. **All accounts:** initials, full name, @username · role, a badge ACTIVE / LOCKED / DEACTIVATED, and a **Deactivate {first name}** or **Bring back {first name}** button. A line: "Accounts are never deleted. A deactivated account cannot log in, but its sales stay in the records." **Add a user** form: full name, username, first password, role (Shopkeeper / Owner), **Create account**. |

## 4. API used
| Call | When |
|---|---|
| `GET /users` | The list and the locked banners |
| `POST /users/{id}/unlock` | Unlock |
| `PATCH /users/{id}` `{is_active}` | Deactivate / bring back |
| `POST /users` `{full_name, username, password, role}` | Create account |

Answers to handle: 409 `username_taken` ("That username is already used"), 409 `cannot_deactivate_self` (the screen never offers it), 404 (someone changed the list meanwhile: show the message and reload), 403 (the screen never offers it).

## 5. Rules and design decisions
1. **Owner only.** The menu entry is already owner only (F2); the route is inside RequireOwner (F3). The server refuses anyway (403).
2. **Badges:** LOCKED wins over ACTIVE. A deactivated account shows DEACTIVATED (and LOCKED too if it is also locked, so the owner knows unlock is still needed after bringing it back: B1 rule 6).
3. **Your own row** says "(you)" and has no Deactivate button (the server refuses it, B1 rule 4).
4. **Deactivate asks first** (question 2): a small confirm panel, "Deactivate Asha Juma? Asha will not be able to log in. Her sales stay in the records." **Yes, deactivate** / **Cancel**. Nothing is sent until Yes. **Bring back** needs no confirm (it is easy to undo).
5. **Unlock needs no confirm**: the banner itself is the check ("Check it was really Asha").
6. **Add a user: checked on screen first,** the same rules as the server (`UserCreate`): full name 1 to 100 characters, username 3 to 50 of letters, numbers, dot or underscore, password at least 8 characters. Each problem is shown under its field and blocks Create. Why: the server's 422 answer has no friendly sentence, and api.ts would show "Request failed (422)".
7. **Role must be chosen** (question 3): no role is preselected, the same as "Paid with" (F5) and the adjust reason (F7). Creating an owner gives full access, so it should never happen by default.
8. **Password field** is `type="password"`, never shown, never kept anywhere after the request (not in sessionStorage, not in the address). The form is cleared after a successful create.
9. **After any change** (unlock, deactivate, bring back, create) the list reloads from the server, and a note says what happened ("Asha Juma unlocked", "Account created for Neema Said").
10. **One click = one save:** the button says "Saving…" and is disabled while waiting.

## 6. Implementation
| File | Change |
|---|---|
| `frontend/src/pages/Users.tsx` | The page, replacing the F2 placeholder (rules 2–10) |
| `frontend/src/users.ts` (new) | Plain functions: `userBadges(user)`, `initials(name)`, `firstName(name)`, `checkNewUser(form)` (rule 6), easy to test |
| `frontend/src/theme.css` | Locked banner, account rows, badges, the add form, the confirm panel |
| `frontend/tests/users.test.tsx` (new) | Page tests below |
| `frontend/tests/users-rules.test.ts` (new) | Tests for `users.ts` |

No backend change. `types.ts` already has `User`.

## 7. Tests
`frontend/tests/users-rules.test.ts`
- `badges: active, locked, deactivated, deactivated and locked`
- `initials and first name from a full name`
- `checkNewUser: empty name, short username, bad characters, short password, all good`

`frontend/tests/users.test.tsx` (fetch faked)
- `lists every account with name, @username, role and badge`
- `locked account shows a banner; Unlock calls /users/{id}/unlock, reloads and shows a note`
- `no banner when nobody is locked`
- `your own row says (you) and has no Deactivate button`
- `deactivate asks first; Cancel sends nothing; Yes sends PATCH {is_active:false} and reloads`
- `deactivated account shows Bring back; it sends PATCH {is_active:true}`
- `add a user: problems are shown under their fields and nothing is sent`
- `add a user: no role chosen blocks Create`
- `add a user: sends {full_name, username, password, role}, clears the form, reloads, shows a note`
- `add a user: username_taken shows "That username is already used" and keeps the form`
- `a button says Saving… and is disabled while waiting`
- `shopkeeper opening /users sees Owner only and GET /users is never asked`

## 8. Done checklist
- [ ] On the real API (demo accounts): add a shopkeeper, log in as them in another tab, lock them with 3 wrong tries, unlock, deactivate (their tab is sent to Log in on the next click), bring back.
- [ ] Light and dark mode, and phone width, look right; nothing scrolls sideways; every button works with the keyboard.
- [ ] Every test in section 7 passes; `npm run build` green; backend `pytest` still 117.
- [ ] No file outside section 6 changed.
- [ ] docs/progress.md updated (F10 Done, decisions, Next, test counts).

## 9. Open questions (answer before coding)
1. **Rename on this page?** The API can rename since B1, but the design has no rename.
   Recommendation: not in F10. Keep the unit the size of the design; a rename can be its own small unit later if a name is ever typed wrong.
2. **Confirm before deactivating?**
   Recommendation: yes. Deactivating logs the person out at once; one wrong click at the counter should not do that. Bring back and Unlock need no confirm.
3. **Role in the add form: preselect Shopkeeper (as the design shows) or must choose?**
   Recommendation: must choose. Creating an owner by accident gives someone the money totals and buying prices.
4. **Can the owner deactivate another owner?** The server allows it (only yourself is refused); the design hides Deactivate on every owner row.
   Recommendation: allow it, except on your own row. If a second owner leaves the business, there must be a way to stop their access.
