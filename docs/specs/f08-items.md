# Unit F8: Items and prices

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: F3 (log in, owner role), F4 (useApi, Panel, format helpers), backend unit 5 (items, sub-items, prices, price history).
Built before F6 and F5 (Iddy, 2026-11-05): the clean database has no items, and a delivery or a sale needs items to choose from.

## 1. Goal
The owner builds the depot's real product list from the screen: add items (Soda, Biscuit…) with their price, add sub-items (Fanta, Chocolate…), change a price with a confirm step that shows old and new, see the price history, rename, set low-stock levels, and stop or bring back what is sold. After F8 the owner can enter everything the depot sells, ready for real deliveries (F6) and sales (F5).
User stories covered (docs/requirements.md section 5): #3 (add items and sub-items and set prices), #4 (change a price with a confirmation step), #13 (stop selling and bring back).

## 2. Out of scope for this unit
- Stock. New sub-items start at 0; stock comes in with deliveries (F6). No screen here changes stock.
- Buying prices (entered on deliveries, F6).
- Deleting anything (never hard-delete).
- Moving a sub-item to another item (not in the API).

## 3. Pages (all owner-only, behind RequireOwner from F3)
| Address | Page | From the design |
|---|---|---|
| `/items` | Items and prices: one card per item with its price, its sub-items (SELLING / STOPPED, own price or "uses item price"), and buttons Change price, Edit, Add sub-item. A side panel shows the price history of the chosen item | Items and prices |
| `/items/new` | New item: name and item price | Add or edit item (left form) |
| `/items/:groupId/edit` | Edit item: rename, stop selling / bring back | (same form style) |
| `/items/:groupId/new-sub-item` | New sub-item in that item: name, price (use item price / own price), low-stock level | Add or edit item |
| `/items/sub-items/:productId/edit` (under /items so the menu keeps "Items and prices" marked) | Edit sub-item: name, price, low-stock level, stop selling / bring back | Add or edit item (right form) |

## 4. API used
| Call | When |
|---|---|
| `GET /groups?include_stopped=…`, `GET /products?include_stopped=…` | The list |
| `POST /groups` `{name, price}` | New item |
| `PATCH /groups/{id}` `{name?, is_active?}` | Rename, stop, bring back an item |
| `PUT /groups/{id}/price` `{price}` | Change an item's price (after confirm) |
| `GET /groups/{id}/price-history` | Price history panel |
| `POST /products` `{group_id, name, own_price, min_level}` | New sub-item |
| `PATCH /products/{id}` `{name?, min_level?, is_active?}` | Rename, low-stock level, stop, bring back a sub-item |
| `PUT /products/{id}/price` `{price}` (number, or `null` = use the item price) | Change a sub-item's own price (after confirm) |

## 5. Rules and design decisions
1. **Prices change only through their own confirm step** (requirements: "asks the owner to confirm, and shows old and new price"). The confirm panel shows *Old 1,000 → New 1,200*, which sub-items will sell at the new price, and "Old receipts keep TSh 1,000". Only **Yes, change** sends the `PUT /…/price`. This mirrors backend unit 5, rule 1: one door for prices, so price history is never skipped.
2. **Same price again:** the API answers `changed: false`; the screen says "The price is already TSh 1,000. Nothing changed."
3. **Forms send only what changed.** Rename sends only `name`; stop sends only `is_active`. A price never travels in a `PATCH` (the API would ignore it anyway).
4. **Sub-item price choice:** two big options, *Use item price (TSh 1,000)* or *Own price*. Choosing "Use item price" on a sub-item that had its own price sends `null` (after the confirm step).
5. **Money input:** whole TSh, digits only (commas allowed while typing, removed before sending), 0 to 10,000,000. The screen checks this to give a quick message, but **the server decides**: any 409 or 422 from the API is shown as the API's message (e.g. "That name is already used", "This item is stopped. Bring it back first.").
6. **Stop / bring back** are plain buttons with a short explanation: "Stops selling. Keeps its N in store and all its history." Nothing is ever deleted, so no "Delete" button exists anywhere.
7. **Stopped items** are hidden by default; a **Show stopped** switch shows them greyed with **Bring back** (question 3).
8. **After saving**, the page returns to `/items` with a short success note ("Soda added", "Price changed to TSh 1,200"), and the list reloads from the API (the screen never edits its own copy of the data).
9. **Buttons are disabled while saving** (one click = one request), like the login button.
10. **Owner only.** Shopkeepers never see the menu entry and get the Owner only page on these addresses (F3). The server's 403 is the real lock.
11. **Empty start:** with no items yet, `/items` shows "No items yet. Add your first item." with the Add item button. This is the first thing the owner sees after the clean start.

## 6. Implementation
| File | Change |
|---|---|
| `frontend/src/api.ts` | Add `apiPatch` and `apiPut` next to `apiGet` / `apiPost` (same token, same error handling) |
| `frontend/src/types.ts` | `Group`, `Product`, `PriceChange`, `PriceHistoryEntry` (mirror app/schemas.py) |
| `frontend/src/money.ts` (new) | `parseTsh("1,200")` → `1200` or an error message (rule 5) |
| `frontend/src/pages/Items.tsx` | The list, price change confirm panel, price history panel, Show stopped |
| `frontend/src/pages/ItemForm.tsx` (new) | New item and edit item |
| `frontend/src/pages/SubItemForm.tsx` (new) | New sub-item and edit sub-item, with the price choice |
| `frontend/src/components/PriceConfirm.tsx` (new) | The confirm step (rule 1), used for items and sub-items |
| `frontend/src/routes.tsx` | The four new addresses, inside RequireOwner |
| `frontend/src/theme.css` | Item cards, sub-item rows, form, price choice and confirm styles from the design |
| `frontend/tests/items.test.tsx` (new), `frontend/tests/money.test.ts` (new) | Tests below |

No backend change.

## 7. Tests
`frontend/tests/items.test.tsx` (fetch faked)
- `empty start shows "No items yet" and an Add item button`
- `list shows each item with its price and sub-items, SELLING and own price or "uses item price"`
- `adding an item sends {name, price} and shows "Soda added" on the list`
- `duplicate name shows the API's "That name is already used"`
- `bad price (letters, negative, too big) is refused before sending`
- `change price shows old → new and old-receipts note; nothing is sent until Yes, change`
- `Cancel on the confirm step sends nothing`
- `same price again says "Nothing changed"`
- `adding a sub-item with "Use item price" sends own_price null; with own price sends the number`
- `sub-item: switching to "Use item price" sends PUT price null after confirm`
- `edit sends only the changed fields (rename sends only name)`
- `stop selling sends is_active false; Show stopped lists it with Bring back`
- `price history panel lists entries newest first with who and when`
- `shopkeeper opening /items/new sees Owner only`
- `buttons are disabled while saving`
`frontend/tests/money.test.ts`
- `parseTsh accepts "1200" and "1,200", refuses "abc", "-5", "10000001", ""`

## 8. Done checklist
- [ ] Against a throwaway API (not your clean depot.db): add Soda 1,000 with Fanta, Coca-Cola; change Soda to 1,200 with confirm; give Fanta its own price; stop and bring back; price history shows every change.
- [ ] Light and dark mode, and phone width, look right; nothing scrolls sideways.
- [ ] Every test in section 7 passes; `npm run build` green; backend `pytest` still 106.
- [ ] No file outside section 6 changed.
- [ ] docs/progress.md updated (F8 Done, decisions, Next = F6, test counts).
- [ ] Your depot.db stays clean: you enter the real items yourself.

## 9. Open questions (answered: all four recommendations accepted)
1. **The price confirm step:** a confirm panel on the page (as in the design), or the browser's small pop-up ("OK / Cancel")?
   Recommendation: a panel on the page. It can show old → new, the affected sub-items and "old receipts keep the old price"; the browser pop-up can only show one line of plain text and looks different on every browser.
2. **Separate pages or all on one page?** Add / edit on their own addresses (as in the design), or every form opening inside the list?
   Recommendation: separate pages. Each form gets a clear URL, Back works, and each page stays small enough to understand and test.
3. **Stopped items:** hidden behind a "Show stopped" switch, or always shown greyed out?
   Recommendation: hidden behind the switch (same rule as the API, `include_stopped`). The everyday list stays short; bringing something back is two clicks.
4. **Price history:** a side panel on the list for the chosen item, or its own page?
   Recommendation: a side panel, as in the design. The owner sees the history right next to the item they are changing.
