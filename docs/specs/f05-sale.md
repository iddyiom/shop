# Unit F5: New sale and receipt

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: F8 (items), F6 (stock), F4 (useApi, format helpers, StatusBadge), backend unit 4 (sales, receipts).

## 1. Goal
At the counter, the owner or a shopkeeper picks sub-items, types or taps quantities, sees the line totals and the bill total appear instantly, chooses cash or mobile money, and confirms. The server re-checks stock and recalculates every price and total, saves the sale in one step, and the receipt appears. This is the screen the depot uses most.
User stories covered (docs/requirements.md section 5): #5 (several products in one sale), #6 (totals calculated automatically), #7 (blocked when stock is not enough), #8 (cash or mobile money), #9 (a receipt for each sale).

## 2. Out of scope for this unit
- Printing receipts (parked).
- Debts / selling on credit (Version 2).
- Discounts or changing a price at the counter (prices only change in Items and prices, owner only).
- Cancelling or editing a confirmed sale (history is never edited).
- The list of past sales (F9).

## 3. Pages (both roles; from the design "New sale" and "Receipt")
| Address | Page |
|---|---|
| `/sale` | **Left:** search box, item filter chips (All, Soda, Biscuit…), and a card per sub-item (item, name, price, "N in store", OK / LOW / OUT badge; OUT cards are greyed and cannot be picked). **Right (the strong card):** *The bill*: one line per sub-item with − quantity +, its line total, the **Total**, *Paid with* (Cash / Mobile money), **Confirm sale**, and "Totals here are a preview. The server checks prices and stock again." |
| `/receipt/:saleId` | "Asante! Sale done.", the receipt (number, date and time, sold by, lines with quantity × price = total, total, paid with), **Next customer** (back to an empty `/sale`) and **Done** (Home). Loaded from `GET /sales/{id}`, so a refresh shows it again. |

## 4. API used
| Call | When |
|---|---|
| `GET /products` | The cards: active sub-items with their price (`effective_price`) and stock |
| `POST /sales` `{payment_method, items: [{product_id, quantity}]}` | Confirm sale. **Only which product and how many; never a price or total** |
| `GET /sales/{id}` | The receipt page |

Errors the screen must show on the right line: 409 `item_not_available` ("Item not available"), 409 `item_over` ("Item over: only N in store", with `product_id` and `available`), 422 `unknown_product`.

## 5. Rules and design decisions
1. **The server decides every price and total** (CLAUDE.md, the first rule that must never break). The request contains only `product_id` and `quantity`. Line totals and the bill total on the screen are a **preview** (price shown on the card × quantity) and say so. The receipt shows the **server's** answer.
2. **If a price changed while the page was open**, the server uses the new price. When the receipt total differs from the preview, the receipt page says: "A price changed since the sale screen was opened. This receipt shows the price used." (The screen never "corrects" the server.)
3. **Stock is checked twice, with the same words.** The screen blocks early using the stock on the card: a line above the stock shows "Item over: only 4 in store", OUT cards cannot be picked ("Item not available"). The server checks again when confirming (another sale may have happened); its 409 is shown **on that line**, using `product_id` from the error, and the cards reload to show the new stock.
4. **Picking a sub-item already on the bill adds 1 to its line** instead of a second line (the API would merge them anyway).
5. **Quantities:** − and + buttons, and the number can be typed. Whole numbers from 1 to 100,000 (`parseQuantity` from F6). Pressing − at 1 asks nothing: it removes the line.
6. **Paid with** must be chosen before confirming (question 1).
7. **Confirm sale** is disabled while the bill is empty, a line has a problem, or no payment method is chosen; the button explains why ("Fix the red line to confirm", "Choose how the customer paid"). One click = one sale: "Saving…" while waiting.
8. **Only active sub-items** are shown (stopped ones are not sold).
9. **Search and filter:** the search box matches the sub-item or item name (upper/lower case ignored); the chips filter by item.
10. **The unfinished bill is kept for this tab** while the person checks another page (question 3), and cleared after a confirmed sale, by **Clear**, or at log out. It holds no prices, only product ids and quantities; prices always come fresh from `GET /products`.
11. **Receipt numbers, dates and times** come from the server (`id`, `sold_at` read as text, F4 rule).
12. **Both roles** sell. A shopkeeper's receipt shows the same as the owner's (receipts are not secret; the day's money total stays owner-only on Home).

## 6. Implementation
| File | Change |
|---|---|
| `frontend/src/bill.ts` (new) | Pure functions for the bill: add a product, set / step a quantity, remove, check each line against stock, the preview totals; save and load the bill for this tab (rule 10). No React, easy to test |
| `frontend/src/pages/Sale.tsx` | The sale page (section 3, rules 1–9) |
| `frontend/src/pages/Receipt.tsx` (new) | The receipt page (rules 2, 11) |
| `frontend/src/auth.tsx` | `logOut()` also clears the saved bill (rule 10) |
| `frontend/src/api.ts` | `ApiError` keeps the error's extra fields (`details`, e.g. `product_id`, `available`), so a server refusal can be shown on the right line (rule 3). Added while building |
| `frontend/src/routes.tsx` | `/receipt/:saleId` inside the logged-in layout |
| `frontend/src/theme.css` | Product cards, chips, bill lines, steppers, payment toggle, receipt |
| `frontend/tests/bill.test.ts` (new), `frontend/tests/sale.test.tsx` (new) | Tests below |

No backend change.

## 7. Tests
`frontend/tests/bill.test.ts`
- `adding a product twice makes one line with quantity 2`
- `stepping down from 1 removes the line`
- `preview line total = card price × quantity; bill total = sum of lines`
- `a line above the stock gets "Item over: only N in store"; stock 0 gets "Item not available"`
`frontend/tests/sale.test.tsx` (fetch faked)
- `cards show price, stock and badge; OUT cards cannot be picked`
- `clicking a card adds it to the bill; totals appear instantly`
- `typing a quantity above stock marks the line and blocks Confirm`
- `Confirm needs a payment method`
- `the request contains only product_id, quantity and payment_method: no price, no total`
- `after confirming, the receipt page shows the server's prices and total`
- `a price changed since opening: the receipt shows the server's price and the note`
- `a 409 item_over from the server marks that line, shows the message and reloads the stock`
- `search and item chips filter the cards`
- `the bill survives going to another page and back; Clear empties it`
- `the button says Saving… and is disabled while waiting`
- `the receipt page loads by its address (refresh) and Next customer opens an empty sale`

## 8. Done checklist
- [ ] On a throwaway API: a sale of 2 sub-items with cash, the receipt shows the server's totals, stock and Home update; a sale above the stock is blocked on screen; a stale-stock sale is refused by the server and shown on the line; a shopkeeper sale works the same.
- [ ] The network request for a sale contains no price and no total (checked in the browser).
- [ ] Light and dark mode, and phone width, look right; nothing scrolls sideways.
- [ ] Every test in section 7 passes; `npm run build` green; backend `pytest` still 106.
- [ ] No file outside section 6 changed. Your depot.db is not touched by the checks.
- [ ] docs/progress.md updated (F5 Done, decisions, Next = F7, test counts).

## 9. Open questions (answered: all four recommendations accepted)
1. **Paid with:** must the person choose cash or mobile money every time, or start on Cash?
   Recommendation: must choose. A default is easy to forget to change, and then the records say "cash" for mobile money payments; the owner relies on this split.
2. **After confirming:** open the receipt page (as in the design), or stay on the sale screen with a small receipt?
   Recommendation: open the receipt page. The customer can see it; **Next customer** is one big button back to an empty sale; and the receipt has its own address, so a refresh does not lose it.
3. **An unfinished bill when the person opens another page** (e.g. checks Store balance mid-sale): keep it for this tab, or lose it?
   Recommendation: keep it for this tab (sessionStorage, like the login), cleared after the sale, by Clear, or at log out. Interruptions are normal at a counter. It stores no prices, so nothing can go stale or be tampered with.
4. **Finding sub-items:** search box and item chips (as in the design), or just the search box?
   Recommendation: both. Chips are fastest with a short list on a laptop; search is fastest when the list grows.
