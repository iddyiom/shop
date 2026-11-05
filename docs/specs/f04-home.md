# Unit F4: Home for owner and shopkeeper

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: F3 (log in, real role), backend units 4 (sales), 7 (low stock), 8 (summary).

## 1. Goal
Home shows today's real numbers the moment someone logs in. The owner sees money taken today, items sold, how many sub-items are low or out, the last restock, what needs restocking, and the latest sales. A shopkeeper sees the same without any money total. This is the first screen built from real API data.
User stories covered (docs/requirements.md section 5): #10 (store balance and low-stock warnings, as a summary), plus the owner persona ("know stock, sales and profit at any moment").

## 2. Out of scope for this unit
- Recording a sale (F5). The big **New sale** button stays as built in F2.
- The full store balance and the full sales list (F7, F9). Home links to them.
- Other days, charts, profit (reports are parked).

## 3. API used
| Call | Gives | Notes |
|---|---|---|
| `GET /summary/today` | `date`, `items_sold`, `low_stock_count`, `last_restock`; owner also `sales_total` | The server decides what "today" is (depot time) |
| `GET /stock/low` | LOW and OUT sub-items, OUT first | Same list as the Store balance warnings |
| `GET /sales?day=<date>` | Today's receipts, newest first | `<date>` = the `date` from `/summary/today` |

## 4. What each role sees (from the design)
| Part | Owner | Shopkeeper |
|---|---|---|
| Greeting "Habari, <name>" + big New sale button | yes | yes |
| Card SALES TODAY (TSh) (the strong, highlighted card) | yes | **no**: never sent by the API |
| Cards ITEMS SOLD TODAY, LOW OR OUT, LAST RESTOCK | yes | yes (ITEMS SOLD becomes the highlighted card) |
| "Needs restocking" list (status badge, sub-item, item, how many left) | yes | yes, titled "Tell the owner: running low" |
| "Latest sales" (time, sold by, items, paid, total) | yes | see question 1 |

## 5. Rules and design decisions
1. **"Today" comes from the server.** Home first asks `/summary/today` and then uses its `date` for `/sales?day=`. The laptop's own clock and time zone are never used. *Why: a laptop set to the wrong date or time zone must not show the wrong day's sales.*
2. **Times are shown as the server wrote them.** `sold_at` is already depot time (e.g. `2026-11-05T14:32:00`), so the screen shows `14:32` by reading the text, not by converting through the browser's time zone.
3. **Money is formatted, never calculated.** `184500` is shown as `184,500`. The screen does not add receipts up; the total comes from `/summary/today` (CLAUDE.md: never trust the screen, and the screen never pretends to be the server).
4. **The money card exists only when the API sends `sales_total`.** A shopkeeper's answer has no such key, so nothing is drawn. No "hidden" money in the page.
5. **Each panel loads on its own:** while waiting it says "Loading…"; if a call fails it shows the API's message and a **Try again** button; the other panels still work.
6. **Empty days are friendly:** no sales yet → "No sales yet today."; nothing low → "Nothing is low or out." (true even when there are no items yet); no deliveries ever → LAST RESTOCK shows "None yet".
7. **Item list on a receipt row:** "2 Fanta, 1 Chocolate" from the receipt's lines. Long lists are cut with "…" and the full text is in a tooltip.
8. **A 401 ends the session** (F3 rule): handled by `api.ts`, nothing extra here.
9. **One small reusable helper, `useApi(path)`**, gives a page `data`, `error`, `loading` and `reload()`. F5 to F10 reuse it.

## 6. Implementation
| File | Change |
|---|---|
| `frontend/src/types.ts` | `Summary`, `StockLine`, `Receipt`, `ReceiptLine` shapes (mirror app/schemas.py) |
| `frontend/src/useApi.ts` (new) | `useApi(path)` hook (rule 9) |
| `frontend/src/format.ts` (new) | `formatTsh(184500)` → `184,500`; `timeOf(sold_at)` → `14:32`; `shortDate('2026-11-01')` → `1 Nov`; `itemsSummary(lines)` |
| `frontend/src/components/StatCard.tsx` (new) | One number card (label, value, note, highlighted or not) |
| `frontend/src/components/StatusBadge.tsx` (new) | OUT / LOW / OK badge (reused by F5 and F7) |
| `frontend/src/components/Panel.tsx` (new) | A card with title, optional link, and the loading / error / Try again states (rule 5) |
| `frontend/src/pages/Home.tsx` | The real Home: cards, needs-restocking list, latest sales |
| `frontend/src/theme.css` | Card grid, badge, list and table styles from the design |
| `frontend/tests/home.test.tsx` (new) | Tests below |
| `frontend/tests/format.test.ts` (new) | Tests for format.ts |

No backend change.

## 7. Tests
`frontend/tests/home.test.tsx` (fetch faked)
- `owner sees the 4 cards with formatted money: SALES TODAY 184,500`
- `shopkeeper sees 3 cards and no day total (receipt rows still show each receipt's own total)`
- `sales are asked for the server's date, not the laptop's`
- `needs restocking lists OUT and LOW with badges and how many left`
- `latest sales shows time 14:32, sold by, items summary, paid and total`
- `empty day: "No sales yet today.", "Nothing is low or out.", LAST RESTOCK "None yet"`
- `a failed panel shows the API message and Try again reloads it; other panels still show`
- `All sales and Store balance links go to /sales and /stock`
`frontend/tests/format.test.ts`
- `formatTsh adds thousands separators`
- `timeOf reads HH:MM without time zone conversion`
- `shortDate turns 2026-11-01 into 1 Nov`
- `itemsSummary joins lines as "2 Fanta, 1 Chocolate"`

## 8. Done checklist
- [ ] Home shows real numbers from the local API for the demo owner and demo shopkeeper (after `add-example-data` and one test sale).
- [ ] The shopkeeper's page contains no money total (checked in the browser, not only in tests).
- [ ] Light and dark mode, and phone width (375 px), look right; nothing scrolls sideways.
- [ ] Every test in section 7 passes; `npm run build` green; backend `pytest` still 106.
- [ ] No file outside section 6 changed.
- [ ] docs/progress.md updated (F4 Done, decisions, Next = F5, test counts).

## 9. Open questions (answered: all four recommendations accepted)
1. **Shopkeeper's sales panel.** The design shows "My receipts today", but the API gives each receipt's seller as a name only, and two people can share a name. Show "Latest sales" (everyone's, like the owner) to the shopkeeper too, or build "My receipts" (needs a small backend change to send the seller's id)?
   Recommendation: "Latest sales" for both now. Shopkeepers may already see every receipt (API plan), so nothing new is shown, and no backend change is needed. "My receipts" can come with F9 if the owner wants it.
2. **Refreshing the numbers.** Load when Home opens plus a **Refresh** button, or also refresh by itself every minute?
   Recommendation: on open plus a Refresh button. Simple and predictable; going back to Home after a sale reloads it anyway. Auto-refresh can come later if the owner keeps Home open all day.
3. **How many latest sales?** 5 or 10 rows?
   Recommendation: 5, as in the design. "All sales" opens the full list (F9).
4. **Needs restocking: all, or the first few?**
   Recommendation: all LOW and OUT sub-items. A depot has a short list of products, and hiding an OUT item would defeat the warning.
