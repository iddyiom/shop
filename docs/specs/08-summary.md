# Unit 8: Home summary

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: units 4 (sales), 6 (deliveries), 7 (low-stock rules).

## 1. Goal
The home screen gets its numbers from one call. The owner sees today's sales total in TSh, items sold today, how many sub-items are low or out, and the last restock date. A shopkeeper sees the same, except the money total, which never reaches them.
User stories covered (docs/requirements.md section 5): #10 (low-stock warnings, as a count on the home screen). Supports the owner persona: "know stock, sales and profit at any moment".

## 2. Out of scope for this unit
- Other days, weeks or months (`?day=`), trends and charts: reports are parked.
- Profit (needs buying prices against sales): parked.
- Payment-method totals (cash vs mobile money).
- The tiles and links on the home screen: they are front-end work.

## 3. Endpoints
| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| GET | /summary/today | all | 200, today's numbers (owner: with `sales_total`) | 401 |

### Examples

Owner:
```json
{
  "date": "2026-11-05",
  "items_sold": 126,
  "low_stock_count": 4,
  "last_restock": "2026-11-01",
  "sales_total": 184500
}
```

Shopkeeper: the same, **without the `sales_total` key**:
```json
{ "date": "2026-11-05", "items_sold": 126, "low_stock_count": 4, "last_restock": "2026-11-01" }
```

Nothing recorded yet: `items_sold` 0, `low_stock_count` as counted, `last_restock` `null`, owner's `sales_total` 0.

## 4. Rules and design decisions
1. **"Today" is the depot's day**, East Africa Time, from 00:00 to 24:00, using `now_local()`, the same as `GET /sales?day=`.
2. **`items_sold`** = the total quantity on all of today's receipts (units, not the number of sales). 2 Fanta + 1 Chocolate = 3.
3. **`sales_total`** = the sum of today's sale totals, in whole TSh. Owner only.
4. **`low_stock_count`** = the number of sub-items `GET /stock/low` would list: LOW and OUT, active only. It reuses `list_low_stock`, so the home number and the balance screen can never disagree.
5. **`last_restock`** = the latest `delivered_at` of any delivery (the date on the paperwork, not when it was typed in), or `null` if there are none. A delivery entered today but dated 1 November counts as 1 November.
6. **Money never reaches a shopkeeper:** a separate response schema without `sales_total`, the same pattern as buying prices in unit 6 (invariant 8).
7. **Read-only.** Nothing is written. Counted by the database (`SUM`), not by loading every sale into Python.

## 5. Implementation
| File | Change |
|---|---|
| `app/services/summary.py` (new) | `today_summary(db, for_owner)`: day range, `SUM` queries, `list_low_stock` from `app/services/stock.py`, latest delivery date |
| `app/routers/summary.py` (new) | `GET /summary/today`, thin; picks the schema by role |
| `app/schemas.py` | New section `# ---------- Home summary ----------`: `SummaryOut`, `SummaryOwnerOut` |
| `app/main.py` | Register the router |
| `tests/test_summary.py` (new) | Tests below |

## 6. Invariants touched (docs/architecture.md section 4)
- **#3 server calculates totals:** the total is summed from saved sales, never sent by the screen.
- **#8 owner-only fields never reach a shopkeeper:** money totals, the last part of this invariant.

## 7. Tests
`tests/test_summary.py`
- `test_owner_sees_sales_total_and_items_sold_today`
- `test_shopkeeper_never_sees_sales_total` (no `sales_total` key)
- `test_items_sold_counts_units_not_sales`
- `test_yesterdays_sales_are_not_counted`
- `test_low_stock_count_matches_low_stock_list` (also after stopping a sub-item)
- `test_last_restock_is_latest_delivery_date_not_entry_time`
- `test_empty_day_shows_zeros_and_no_restock`
- `test_must_be_logged_in_to_see_summary`

## 8. Done checklist
- [ ] `GET /summary/today` works as described for both roles.
- [ ] Every test in section 7 exists and passes; full `pytest` green (89 old + new).
- [ ] No shopkeeper response contains `sales_total`.
- [ ] Totals come from `SUM` in the database.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (unit Done, decisions, Next, test count), and invariant #8 in docs/architecture.md names its new test.

## 9. Open questions (answered: all four recommendations accepted)
1. **Low-stock count.** Count LOW and OUT together (same as `/stock/low`), or only LOW?
   Recommendation: together. OUT is the most urgent kind of low, and the home number then matches the list it leads to.
2. **Items sold.** Units (2 Fanta + 1 Chocolate = 3), or number of sales (receipts)?
   Recommendation: units. It is what "items sold" means on the wireframe, and the number of receipts is in `GET /sales?day=` anyway.
3. **Last restock for shopkeepers.** The shopkeeper wireframe does not show it, but the API plan lists it for all. Send it to shopkeepers too?
   Recommendation: yes. It is not secret, and the screen can choose not to show it.
4. **Other days.** Only today, or also `?day=` for a past day?
   Recommendation: only today for Version 1. Past days are reports, and reports are parked.
