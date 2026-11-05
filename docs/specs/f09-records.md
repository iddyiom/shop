# Unit F9: Sales records, restock history and corrections

Status: Done (Iddy accepted all 4 recommendations, 2026-11-05)
Depends on: F4 (useApi, Panel, format helpers), F5 (receipt page `/receipt/:id`), F6 (deliveries), backend units 4 and 6 (sales list, deliveries, corrections).

## 1. Goal
Two history pages, for both roles:
- **Sales records:** every receipt of a chosen day (Today, Yesterday, or any date from the date picker), newest first. Clicking one opens the receipt. The owner also sees the day's money total.
- **Restock history:** every delivery, newest first, with its lines and any corrections. The owner also sees buying prices and can **correct a line** with a reason. The delivery itself is never edited: the correction is a new entry under it, and stock changes by the same amount.

User stories covered (docs/requirements.md section 5): viewing past sales and receipts, viewing past deliveries, #12 (the delivery-correction half; adjustments were F7).

## 2. Out of scope for this unit
- **"This week" and date ranges.** B2 (`GET /sales?from=&to=`) is parked with the reports in Version 2 (question 1).
- Reports, profit, totals per product or per seller (parked: Version 2).
- Fixing a wrong buying price (noticed earlier, still undecided; history is never edited).
- Editing or cancelling a receipt. Receipts never change.
- Printing.

## 3. Endpoints (all already built, no backend change)
| Call | Page | When |
|---|---|---|
| `GET /summary/today` | Sales records | Gets the server's "today" (the date only) |
| `GET /sales?day=YYYY-MM-DD` | Sales records | The receipts of the chosen day |
| `GET /deliveries` | Restock history | The list, newest first (buying prices only in the owner's answer) |
| `GET /deliveries/{id}` | Restock history | The chosen delivery, with lines and corrections |
| `POST /deliveries/{id}/corrections` `{product_id, quantity_change, reason}` | Restock history (owner) | Add a correction |

Answers to handle for a correction:
- 201 `CorrectionOut`, which includes `before` and `after` (the stock).
- 422 `not_on_delivery`, or a validation error (change of 0, reason empty or over 500 characters).
- 409 `correction_too_big` with `available` (the line would go below 0).
- 409 `not_enough_stock` (the store has less than the amount being taken away).
- 403 for a shopkeeper (the screen never offers it).

## 4. Pages, rules and design decisions
### Sales records `/sales` (everyone)
| Part | What it shows |
|---|---|
| Day choice | Chips **Today** and **Yesterday**, plus a **date picker** (the browser's own, `max` = today). Today and Yesterday come from the server's date, never the laptop clock. The chosen day sits in the address (`/sales?day=2026-11-04`), so Refresh and Back keep it. |
| Day card | "Thursday 5 November · 38 receipts". **Owner only:** "TSh 184,500" (question 2). |
| Table | #, time, items ("2 Fanta, 1 Chocolate"), sold by, paid with, total (TSh). A row is a link to `/receipt/:id`. |
| Empty day | "No sales on this day." |
| Footer | "Receipts cannot be changed or deleted." |

Rules:
1. **Times and dates are read as text**, as on Home (F4): no time-zone conversion in the browser. "Yesterday" is worked out from the server's date string by plain date arithmetic.
2. **A future date** cannot be picked (`max`). If one is typed into the address, the page shows "Pick today or an earlier day" and does not ask the API.
3. **Shopkeepers see every receipt** (same decision as F4 "Latest sales") and each receipt's total, since receipts show totals to everyone. They do **not** see the day's money total (requirements section 6: money totals are owner-only).

### Restock history `/restock` and `/restock/:deliveryId` (everyone)
| Part | What it shows |
|---|---|
| List (left) | One card per delivery: date, note, received by, units, and a "corrected" tag if it has corrections. Newest first. Clicking a card opens `/restock/:id` (question 3). |
| Delivery (right) | "Delivery of 1 November", the note, who received it, "Never edited". Table: sub-item, delivered, corrections (+/−), **recorded now** (delivered + corrections), and for the **owner only** the buying price. Below it: "Corrections on this delivery" (change, reason, when, who). |
| Correct a line (owner only) | Sub-item (only those on this delivery, showing "Sprite (48 recorded)"), **Add / Remove** and how many (question 4), reason (required, 1–500 characters), "Add correction". The text: "The delivery stays as it was. The fix is added below it, and stock changes by the same amount." |

Rules:
4. **Never edited.** The delivery's own lines never change on screen. Corrections are shown as extra rows and an extra column.
5. **Buying prices** exist only in the owner's API answer. For a shopkeeper the column does not exist at all (same as F6).
6. **Quick checks before sending:** sub-item chosen, quantity 1 to 100,000 (`parseQuantity`), reason not empty. When removing more than is recorded on the line, show "Only N recorded on this delivery" and block. The server checks everything again. A 409 shows the server's message and reloads the delivery.
7. **After saving**, stay on the delivery (it reloads, so the new correction appears) with a note built from the server's answer: "Fanta: −2 on this delivery. Stock 50 → 48."
8. **One click = one save:** "Saving…" and disabled while waiting.
9. **Without an id**, `/restock` opens the newest delivery. An unknown id shows "Delivery not found" with the list still visible. No deliveries at all shows "No deliveries yet" and a link to Receive stock.

## 5. Implementation
| File | Change |
|---|---|
| `frontend/src/types.ts` | `CorrectionEntry`, `Correction`; `Delivery.corrections` typed (it was `unknown[]`) |
| `frontend/src/format.ts` | `signed` (moved from Stock.tsx), `dayBefore('2026-11-05') → '2026-11-04'`, `longDate('2026-11-05') → 'Thursday 5 November'` (both plain text, no time zones) |
| `frontend/src/pages/SalesRecords.tsx` | The sales records page (replaces the placeholder) |
| `frontend/src/pages/Restock.tsx` | The restock history page with the correction form (replaces the placeholder) |
| `frontend/src/routes.tsx` | `restock/:deliveryId` |
| `frontend/src/theme.css` | Day card, delivery list cards, corrections list |
| `frontend/tests/records.test.tsx` (new) | Tests below |
| `frontend/src/pages/Stock.tsx` | Only an import: the `signed` helper (+3 / −2) moved to `format.ts` so both pages share it (added while building) |
| `frontend/tests/format.test.ts` | `dayBefore` (including the 1st of a month and 1 March in a leap year) and `longDate` |

No backend change.

## 6. Invariants touched
- **History is never edited.** No screen edits a receipt or a delivery line; a correction is a new entry (backend unit 6, tested there; F9 tests check that the form sends only POST to `/corrections`).
- **Owner-only money and buying prices.** The day total and the buying price column are absent for a shopkeeper (tested).
- **Stock never below 0.** Enforced by the server (409); the screen only gives an early message.

## 7. Tests
`frontend/tests/records.test.tsx` (fetch faked)
- `sales records opens on the server's today and lists its receipts, newest first`
- `Yesterday and the date picker ask /sales?day= for that day and put it in the address`
- `opening /sales?day=2026-11-04 shows that day (refresh keeps the day)`
- `a future day in the address shows a message and does not ask the API`
- `a receipt row links to /receipt/:id`
- `owner sees the day's money total; shopkeeper sees the receipt count but no day total`
- `an empty day says "No sales on this day."`
- `restock history opens the newest delivery; clicking another opens /restock/:id`
- `delivery table shows delivered, corrections and recorded now; corrections listed with reason, when, who`
- `owner sees buying prices and the correction form; shopkeeper sees neither`
- `correction: only sub-items on this delivery can be chosen`
- `correction: no reason blocks Save; removing more than recorded shows "Only N recorded on this delivery"`
- `correction: saving sends {product_id, quantity_change: -2, reason}, reloads the delivery and shows the note from the server's answer`
- `correction: a 409 from the server shows its message and reloads the delivery`
- `correction: the button says Saving… and is disabled while waiting`
- `an unknown delivery id shows "Delivery not found"`

## 8. Done checklist
- [x] On a throwaway API: two days of sales and two deliveries. Today / Yesterday / picked day match the API. The owner corrects a delivery (−2, then +1) and Store balance and Fixes to stock (F7) show the same change. A shopkeeper sees no day total, no buying prices, no correction form.
- [x] Light and dark mode, and phone width, look right; nothing scrolls sideways.
- [x] Every test in section 7 passes; `npm run build` green; backend `pytest` still 106.
- [x] No file outside section 5 changed. Your depot.db is not touched by the checks.
- [x] docs/progress.md updated (F9 Done, B2 decision, decisions, Next = B1 then F10, test counts).

## 9. Open questions (answered: all 4 recommendations accepted; B2 parked for Version 2)
1. **B2, "This week":** build a small backend unit first (`GET /sales?from=&to=`) so Sales records can show a week, or drop "This week" for now and keep Today, Yesterday and the date picker?
   Recommendation: drop it for now and park B2 with the reports (Version 2). Looking at receipts is done one day at a time. A week view is really a report (totals over time), and reports are parked. Not building it keeps this unit to the front end only.
2. **The owner's day total on Sales records:** add up the totals of the receipts the server sent for that day, or show a money total only for today (from `/summary/today`)?
   Recommendation: add up the server's receipt totals, shown only to the owner. Every number comes from the server's own receipts, so this is counting what is on the page, not working out prices. It works for any day, not just today. A test checks it against the receipts.
3. **Restock history addresses:** give each delivery its own address (`/restock/12`), or keep the chosen delivery only in the page's memory?
   Recommendation: its own address, like receipts (`/receipt/42`). Refresh and Back keep the delivery you were correcting, and a delivery can be shared by its link.
4. **How the correction amount is entered:** Add / Remove buttons plus a number (like Adjust stock in F7), or one box where the owner types a signed number like "-2"?
   Recommendation: Add / Remove plus a number. It matches Adjust stock, so the owner learns it once. A minus sign is easy to forget, and forgetting it would add stock instead of removing it.
