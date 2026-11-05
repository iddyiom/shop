# Unit F6: Receive stock

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: F8 (items exist), F4 (useApi, Panel, format helpers), backend unit 6 (deliveries).
Built before F5 (Iddy, 2026-11-05): real stock comes in before anything is sold.

## 1. Goal
When the truck arrives, the owner or a shopkeeper records what came: the date (picked on a calendar), an optional note, and one line per sub-item with its quantity. The owner may also enter the buying price per unit. Saving adds the stock for every line at once, and the store balance and Home show the real counts.
User stories covered (docs/requirements.md section 5): #2 (record stock received), #11 (owner records the buying price).

## 2. Out of scope for this unit
- Correcting a saved delivery (F9, Restock history and corrections).
- The full list of past deliveries (F9). This page shows only the latest few.
- Adjustments for damaged or lost goods (F7).
- Adding new items or sub-items here (that is Items and prices, F8; this page links there when the list is empty).

## 3. What the page looks like (from the design "Receive stock")
- **Left card:** *Delivery date* (calendar), *Note (optional)*, then the table *What arrived*: one row per line with *Sub-item* (a list grouped by item), *Quantity*, and for the owner only *Buying price each (TSh)*, plus a remove (×) button. **Add another line** adds a row.
- **Right card (the strong one):** *Stock after saving*: for each line, "Fanta 3 → 51" (a preview), *Units arriving* (the sum of the quantities), the **Save delivery** button, and "All lines are saved together, or none."
- **Below it:** *Last deliveries*: the 5 newest (date, number of lines, units, received by).

## 4. API used
| Call | When |
|---|---|
| `GET /summary/today` | The server's date: the calendar's default and its latest allowed day |
| `GET /products` | The sub-items to choose from (active only), with their stock now |
| `POST /deliveries` `{delivered_at, note, items: [{product_id, quantity, buying_price?}]}` | Save delivery |
| `GET /deliveries` | Last deliveries (newest first) |

## 5. Rules and design decisions
1. **The date is chosen on a calendar:** the browser's own date picker (`<input type="date">`), which works offline and needs no outside service. It starts on **today as the server sees it** (from `/summary/today`, the F4 rule: never the laptop's clock) and cannot go past today (`max`). A past day is allowed (recording yesterday's truck). The server refuses a future date anyway.
2. **Buying price is the owner's only.** A shopkeeper's page has **no buying price column at all** (not a greyed-out one) and never sends the field (the server would answer 403). Invariant 8 in docs/architecture.md.
3. **The preview is a preview.** "3 → 51" is worked out on the screen to help check the numbers; the server adds the stock itself. After saving, the page reloads the sub-items from the API, so the numbers shown are the server's.
4. **All or nothing, visible:** one Save for the whole delivery. If the server refuses (e.g. "Fanta is stopped. Bring it back first."), nothing was saved and the form keeps everything typed, so the owner fixes one line and saves again.
5. **Quick checks before sending** (the server still decides): at least one line; every line has a sub-item; quantity is a whole number from 1 to 100,000; a buying price (if typed) is whole TSh, 0 to 10,000,000. The row with the problem is marked and named in the message ("Line 2: enter a quantity").
6. **The same sub-item on two lines is allowed** (two cartons at different buying prices), as the API allows. The preview adds both.
7. **Only active sub-items can be chosen** (`GET /products` without `include_stopped`), grouped by item, so a stopped one cannot be picked by mistake.
8. **After saving:** a note "Delivery saved: 3 lines, 132 units", the form resets (date stays, one empty line), the stock preview and Last deliveries reload from the API.
9. **No items yet:** the page says so and links the owner to Items and prices ("Ask the owner to add the items first" for a shopkeeper).
10. **One click = one save:** the button shows "Saving…" and is disabled while waiting.
11. **Both roles** can open this page (menu entry for both, as in F2).

## 6. Implementation
| File | Change |
|---|---|
| `frontend/src/types.ts` | `Delivery`, `DeliveryLine` (buying price optional: missing for shopkeepers) |
| `frontend/src/money.ts` | `parseQuantity("48")` (1 to 100,000) |
| `frontend/src/pages/Receive.tsx` | The page (sections 3 and 5) |
| `frontend/src/theme.css` | Delivery table, line rows, stock preview, date field |
| `frontend/tests/receive.test.tsx` (new) | Tests below; `money.test.ts` gets `parseQuantity` |

No backend change.

## 7. Tests
`frontend/tests/receive.test.tsx` (fetch faked)
- `the date starts on the server's today and cannot go past it`
- `owner sees the buying price column; shopkeeper has no such column at all`
- `the sub-item list shows active sub-items grouped by item`
- `stock preview shows "3 → 51" and units arriving`
- `the same sub-item on two lines adds both in the preview`
- `saving sends {delivered_at, note, items} with buying_price only for the owner and only when typed`
- `a shopkeeper's save never contains buying_price`
- `after saving: success note, form reset, stock reloaded from the API`
- `a refused save (item stopped) shows the API's message and keeps the form`
- `quick checks: no sub-item, quantity 0 or "abc", bad buying price; the line is named; nothing sent`
- `Add another line and remove (×) work; the last line cannot be removed`
- `no items yet: owner gets a link to Items and prices`
- `Last deliveries shows date, lines, units and who received`
- `the button says Saving… and is disabled while waiting`
`frontend/tests/money.test.ts`
- `parseQuantity accepts 1..100000, refuses 0, -1, 1.5, "abc", ""`

## 8. Done checklist
- [ ] On a throwaway API: owner records a delivery with two lines (one with a buying price), Home's LAST RESTOCK and stock change, the shopkeeper records one without any buying price field.
- [ ] A delivery for yesterday is accepted; the calendar does not offer tomorrow.
- [ ] Light and dark mode, and phone width, look right; nothing scrolls sideways.
- [ ] Every test in section 7 passes; `npm run build` green; backend `pytest` still 106.
- [ ] No file outside section 6 changed. Your depot.db is not touched by the checks.
- [ ] docs/progress.md updated (F6 Done, decisions, Next = F5, test counts).

## 9. Open questions (answered: all four recommendations accepted)
1. **The date's starting value:** today (as the server sees it), or empty so the person must pick it?
   Recommendation: today. Most deliveries are recorded the day they arrive; the calendar is one click away for yesterday's truck.
2. **After saving:** stay on the page with a success note and a fresh form, or open a page showing the saved delivery?
   Recommendation: stay, with the note. The next truck or the next carton is often recorded right away; the full delivery is visible in Restock history (F9).
3. **The owner's buying price:** optional (as the API allows), or required on every line?
   Recommendation: optional. Sometimes the invoice comes later; requiring it would block recording the stock. Profit reports (later) will simply skip lines without a price.
4. **Last deliveries on this page:** show the 5 newest, or nothing (leave it all to F9)?
   Recommendation: the 5 newest, as in the design. It answers "did I already record this truck?" without leaving the page.
