# Unit B1: Edit or deactivate a user (`PATCH /users/{id}`)

Status: Done (2026-11-06). Spec agreed with all three recommendations in section 9 accepted.
Depends on: unit 3 (auth, users). Needed before F10 (Users screen).

## 1. Goal
The owner can fix a staff member's full name, and can deactivate someone who has left (and reactivate them later). A deactivated person cannot log in, and their current session stops working on their next request. Nothing is deleted: their old sales and deliveries still show their name.
User stories covered (docs/requirements.md section 5): #1 (only authorized people use the system). Permissions table: "Add users, unlock locked accounts" (owner only).

## 2. Out of scope for this unit
- Changing the username, role or password. No password reset either (see "Noticed" in section 9).
- Deleting a user. Never: invariant "nothing is hard-deleted".
- Unlocking: it already has its own endpoint, `POST /users/{id}/unlock`.
- Ending tokens on the server at log out (known gap, fixed with deployment).
- Any screen: that is F10.

## 3. Endpoints
| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| PATCH | /users/{id} | owner | 200, the updated user (`UserOut`) | 401, 403 shopkeeper, 404 no such user, 409 `cannot_deactivate_self`, 422 bad input |

### Examples
Rename:
```json
{ "full_name": "Asha Juma" }
```
Deactivate (and later reactivate with `true`):
```json
{ "is_active": false }
```
Response (same shape as `GET /users`):
```json
{ "id": 3, "full_name": "Asha Juma", "username": "asha", "role": "shopkeeper", "is_locked": false, "is_active": false }
```

## 4. Rules and design decisions
1. **Only what is sent changes**, as in `PATCH /groups/{id}`. Both fields are optional; an empty body `{}` changes nothing and returns the user.
2. **Only two fields: `full_name` and `is_active`.** Any other field (`role`, `username`, `password`) is refused with 422, not silently ignored. Why: the owner must never believe a role was changed when it was not.
3. **`full_name` uses the shared `Name` rule:** spaces at the ends are trimmed, 1 to 100 characters. Names do not have to be unique (two people can share a name; the username is what is unique).
4. **The owner cannot deactivate their own account** (409 `cannot_deactivate_self`, "You cannot deactivate your own account"). Why: it could leave the depot with no one able to log in. Another owner may still deactivate them.
5. **Deactivating works at once.** No new code needed: `CurrentUser` (app/deps.py) already refuses an inactive user with 401, and login already refuses them. Tests prove both.
6. **Reactivating does not unlock.** If the account was locked, it stays locked until the owner presses Unlock. Why: two separate actions, each does one thing.
7. **History is untouched.** The user row stays, so sales, deliveries and price changes still point to them.

## 5. Implementation
| File | Change |
|---|---|
| `app/services/users.py` (new) | `update_user(db, owner, user_id, request)`: find the user (404), check rule 4, apply the fields, one commit |
| `app/routers/users.py` | Add `PATCH /{user_id}`, thin: calls `update_user`, `response_model=UserOut` |
| `app/schemas.py` | `UserUpdate` in the "Auth and users" section: `full_name: Name \| None`, `is_active: bool \| None`, `extra="forbid"` |
| `tests/test_users.py` (new) | Tests below |

The existing create, list and unlock code stays where it is (not moved in this unit).

## 6. Invariants touched (docs/architecture.md section 4)
- **#7 owner-only actions refused for shopkeepers:** `OwnerUser` on the endpoint; tested.
- **Never hard-delete:** deactivate sets `is_active = False`; the row and its history stay.
- **#9 passwords hashed:** not touched; the password cannot be sent here at all (rule 2).

## 7. Tests
`tests/test_users.py`
- `test_owner_renames_user`
- `test_name_is_trimmed_and_empty_name_refused`
- `test_empty_body_changes_nothing`
- `test_unknown_field_like_role_is_refused` (role stays shopkeeper)
- `test_owner_deactivates_user_who_then_cannot_log_in`
- `test_deactivated_users_token_stops_working`
- `test_owner_reactivates_user`
- `test_reactivating_keeps_account_locked`
- `test_owner_cannot_deactivate_self`
- `test_patch_unknown_user_is_404`
- `test_shopkeeper_cannot_edit_users` (403)

## 8. Done checklist
- [x] `PATCH /users/{id}` works as described in sections 3 and 4.
- [x] Every test in section 7 exists and passes; full `pytest` green.
- [x] Shopkeeper gets 403.
- [x] No model change, so no migration.
- [x] No file outside section 5 changed (plus docs/progress.md, docs/api-plan.md if wording changes). `Name` moved to the top of app/schemas.py so the users section can use it (same rule, not changed).
- [x] docs/progress.md updated (unit Done, decisions, Next = F10, test count).

## 9. Open questions (answer before coding)
1. **Block deactivating yourself (rule 4)?** Recommendation: yes. If the only owner deactivates themself, nobody can log in except through the terminal (`create-owner`).
2. **Refuse unknown fields with 422 (rule 2)?** Recommendation: yes, clearer and safer than ignoring them.
3. **Reactivating keeps a lock (rule 6)?** Recommendation: yes, unlock stays its own button.

Noticed (not in this unit): there is no way for the owner to reset a forgotten password. Today only the terminal can help. Worth its own small unit later.
