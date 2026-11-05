# Unit F7: Store balance and adjust stock

Status: Done (Iddy accepted all 4 recommendations, 2026-11-05)
Depends on: F4 (useApi, Panel, StatusBadge, format helpers), F5/F6 (stock moves), backend unit 7 (stock, adjustments, stock entries).

## 1. Goal
Everyone can see what is in the store: every sub-item with its stock, its low-stock level and OK / LOW / OUT, with search and filters. The owner can also fix the stock when goods are damaged, expired, lost or counted differently, always with a reason, and sees the latest fixes. Nothing is ever edited: every fix is a new history entry.
User stories covered (docs/requirements.md section 5): #10 (store balance and low-stock warnings), #12 (adjust stock for damaged, expired or lost goods, with a reason; the delivery-correction half is F9).

## 2. Out of scope for this unit
- Correcting a delivery (F9, Restock history).
- The full history page of every correction and adjustment (F9 shows corrections per delivery; this page shows the latest fixes).
- Changing low-stock levels (Items and prices, F8).
- Money: stock screens never show prices or values (backend unit 7, rule 1).

## 3. Pages (from the design "Store balance" and "Adjust stock")
| Address | Who | Page |
|---|---|---|
| `/stock` | everyone | **Counts:** OUT n, LOW n, OK n. **Filters:** search box, item chips, *Show stopped*. **Table:** sub-item, item, in store, low at, status, and for the owner an **Adjust** button per row. **Right panel (owner only):** *Fixes to stock*: the latest corrections and adjustments (sub-item, +/− change, reason, kind, when, who), "never edited, only added". |
| `/stock/:productId/adjust` | owner | Three steps: **1** Add or remove? **2** How many? **3** Why? (Damaged / Expired / Lost or missing / Counted differently). A strong panel shows *In store now → After* and **Save adjustment**. |

## 4. API used
| Call | When |
|---|---|
| `GET /stock?include_stopped=true` | The table (one load; filtering happens on the screen, question 1) |
| `GET /stock-entries` | Fixes to stock (owner only) |
| `POST /products/{id}/adjustments` `{direction, quantity, reason}` | Save adjustment |

Answers to handle: 201 with `before` and `after`; 422 `reason_needs_remove`; 409 `not_enough_stock` with `available`; 403 for a shopkeeper (the screen never offers it).

## 5. Rules and design decisions
1. **No money on stock screens**, for anyone (backend unit 7, rule 1).
2. **Stopped sub-items** are hidden unless *Show stopped* is on (same as Items and prices); then they show greyed with "STOPPED". The owner can still adjust them (expired stock of a stopped product must still leave the store, backend rule 9).
3. **Counts** (OUT / LOW / OK) are counted from the same list the table shows, so they always agree. Clicking a count shows only that status (question 4).
4. **Reason and direction must make sense** (backend rule 7): when **Add** is chosen, Damaged / Expired / Lost or missing are locked and say why; only *Counted differently* can add. The server refuses anyway (422) if the rule is bypassed.
5. **The reason must be chosen** every time (question 2): no reason is preselected.
6. **Quick checks before sending:** quantity 1 to 100,000 (`parseQuantity`); removing more than is in store shows "Only N in store" and blocks Save. The server checks again (409 `not_enough_stock`, e.g. if a sale happened meanwhile); its message is shown and the stock is reloaded.
7. **The preview** "5 → 3" is a preview; after saving, the note uses the server's `before` and `after` ("Fanta: 5 → 3 (Damaged)").
8. **After saving**, back to `/stock` with that note (question 3), and the table and the fixes reload.
9. **Owner only for fixes:** a shopkeeper sees no Adjust buttons and no Fixes panel (the API refuses `/stock-entries` with 403), and gets the Owner only page on `/stock/…/adjust` (F3 RequireOwner).
10. **Fixes are never edited:** the panel says so; a wrong adjustment is fixed with a new one the other way.
11. **One click = one save:** "Saving…" and disabled while waiting.

## 6. Implementation
| File | Change |
|---|---|
| `frontend/src/types.ts` | `StockEntry`, `Adjustment` (mirror `StockEntryOut`, `AdjustmentOut`) |
| `frontend/src/pages/Stock.tsx` | The store balance page (rules 1–3, 9) |
| `frontend/src/pages/Adjust.tsx` (new) | The adjust page (rules 4–8, 11) |
| `frontend/src/routes.tsx` | `/stock/:productId/adjust` inside RequireOwner |
| `frontend/src/theme.css` | Count pills, stock table, fixes list, the three-step form, reason tiles |
| `frontend/tests/stock.test.tsx` (new) | Tests below |

No backend change.

## 7. Tests
`frontend/tests/stock.test.tsx` (fetch faked)
- `table shows every sub-item with in store, low at and status; no money anywhere`
- `counts OUT / LOW / OK match the list; clicking LOW shows only LOW rows`
- `search and item chips filter the table`
- `stopped sub-items are hidden until Show stopped`
- `owner sees Adjust buttons and the Fixes to stock panel; shopkeeper sees neither and /stock-entries is not asked`
- `shopkeeper opening /stock/1/adjust sees Owner only`
- `fixes panel lists change, reason, kind, when and who, newest first`
- `adjust: choosing Add locks Damaged, Expired and Lost; Counted differently stays open`
- `adjust: no reason chosen blocks Save`
- `adjust: removing more than in store shows "Only N in store" and blocks Save`
- `adjust: preview shows 5 → 3 for remove 2`
- `adjust: saving sends {direction, quantity, reason} and returns to /stock with "Fanta: 5 → 3 (Damaged)"`
- `adjust: a 409 not_enough_stock from the server shows its message and reloads the stock`
- `adjust: the button says Saving… and is disabled while waiting`
- `adjust: switching to Add drops a reason that can only remove` (added while building)

## 8. Done checklist
- [x] On a throwaway API: the table matches the real stock; the owner removes 2 damaged and adds 1 counted differently; the fixes panel shows both; Home's numbers change; a shopkeeper sees the table only.
- [x] Light and dark mode, and phone width, look right; nothing scrolls sideways.
- [x] Every test in section 7 passes; `npm run build` green; backend `pytest` still 106.
- [x] No file outside section 6 changed. Your depot.db is not touched by the checks.
- [x] docs/progress.md updated (F7 Done, decisions, Next = F9, test counts).

## 9. Open questions (answered: all 4 recommendations accepted)
1. **Search and filters:** filter on the screen from one load of the list, or ask the API again on every keystroke (`?search=`)?
   Recommendation: filter on the screen. The depot's list is short; typing feels instant and works even if the network is slow. (The API's `?search=` stays available for later.)
2. **The reason:** must it be chosen every time, or start on "Counted differently"?
   Recommendation: must choose. The reason is the whole point of an adjustment; a preselected one would end up on records where it is not true (same thinking as "Paid with" in F5).
3. **After saving an adjustment:** back to Store balance with a note, or stay on the adjust page?
   Recommendation: back to Store balance, so the owner immediately sees the new number in the list and the new entry in Fixes to stock.
4. **The OUT / LOW / OK counts:** also act as filters when clicked, or only show numbers?
   Recommendation: act as filters. "Show me what is OUT" is the most common question on this page, and it is one click.
