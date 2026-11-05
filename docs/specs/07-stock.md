# Unit 7: Store balance and adjustments

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: units 5 (items and sub-items), 6 (deliveries and corrections).

## 1. Goal
Everyone logged in can see how much of each sub-item is in the store, with LOW and OUT warnings. The owner can adjust stock for damaged, expired, lost or miscounted goods with a required reason, and can read the full history of corrections and adjustments.
User stories covered (docs/requirements.md section 5): #10 (store balance and low-stock warnings), #12 (the adjustment half; corrections were unit 6).

## 2. Out of scope for this unit
- The home summary (low-stock count, last restock date): unit 8.
- Money: no prices or values in the stock views.
- Stock counts / stock-taking sessions (counting the whole store at once). One adjustment = one sub-item.
- Undoing an adjustment. A wrong adjustment is fixed with a new adjustment the other way.
- Van stock (parked).

## 3. Endpoints
| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| GET | /stock | all | 200, balance of every sub-item; filters `?group_id=`, `?search=`, `?include_stopped=true` | 401 |
| GET | /stock/low | all | 200, only LOW and OUT sub-items, OUT first | 401 |
| POST | /products/{product_id}/adjustments | owner | 201, the adjustment with before and after | 403, 404, 409 `not_enough_stock`, 422 `reason_needs_remove`, 422 |
| GET | /stock-entries | owner | 200, corrections and adjustments, newest first; filters `?product_id=`, `?kind=`, `?day=` | 403 |

### Examples

`GET /stock?search=fan`
```json
[
  { "product_id": 3, "product": "Fanta", "group_id": 1, "group": "Soda",
    "quantity_in_store": 5, "min_level": 6, "stock_status": "LOW", "is_active": true }
]
```

`POST /products/3/adjustments`
```json
{ "direction": "remove", "quantity": 2, "reason": "Damaged" }
```
-> 201
```json
{
  "id": 9, "kind": "adjustment", "product_id": 3, "product": "Fanta", "delivery_id": null,
  "quantity_change": -2, "before": 5, "after": 3, "reason": "Damaged",
  "by": "Depot Owner", "at": "2026-11-05T20:10:00"
}
```

`GET /stock-entries?product_id=3`
```json
[
  { "id": 9, "kind": "adjustment", "product_id": 3, "product": "Fanta", "delivery_id": null,
    "quantity_change": -2, "reason": "Damaged", "by": "Depot Owner", "at": "2026-11-05T20:10:00" },
  { "id": 4, "kind": "correction", "product_id": 3, "product": "Fanta", "delivery_id": 12,
    "quantity_change": -2, "reason": "Counted again, truck brought 46", "by": "Depot Owner", "at": "2026-11-05T10:40:00" }
]
```

## 4. Rules and design decisions
1. **Stock views show quantities, never money.** Same response for owner and shopkeeper.
2. **Status** uses the existing `stock_status`: OUT when 0, LOW when at or below `min_level`, otherwise OK.
3. **`GET /stock`** is sorted by item name, then sub-item name. `search` matches part of the sub-item name or the item name, ignoring upper/lower case. `group_id` limits it to one item. (The API plan wrote `?group=`; we use `?group_id=` to match `GET /products`. docs/api-plan.md is updated.)
4. **Stopped sub-items** (or sub-items of a stopped item) are hidden from `GET /stock` unless `?include_stopped=true`, and never shown in `GET /stock/low` (nobody restocks what is not sold).
5. **`GET /stock/low`** lists OUT first, then LOW; inside each group, by item name then sub-item name.
6. **An adjustment** has `direction` (`add` or `remove`), `quantity` (1 to 100,000) and `reason`, one of exactly: `Damaged`, `Expired`, `Lost or missing`, `Counted differently`.
7. **Reason and direction must make sense:** `Damaged`, `Expired` and `Lost or missing` can only remove (422 `reason_needs_remove`). `Counted differently` can add or remove.
8. **An adjustment adds one `stock_entries` row** (`kind = "adjustment"`, no `delivery_id`, who, when, reason) and changes stock, in one transaction. Removing uses the guarded update, so stock never goes below 0: 409 `not_enough_stock` with `available`.
9. **Adjustments are allowed on stopped sub-items.** *Why: expired stock of a stopped product still has to leave the store.*
10. **Stock changes live in one helper.** A new `change_stock(db, product, change)` in `app/services/stock.py` does the database-side add and, for removals, the guarded update. Corrections (unit 6) switch to it, so the same rule is written once. Sales keep their own update (their errors and messages are different).
11. **`GET /stock-entries`** is owner-only, newest first. `kind` is `correction` or `adjustment`. `day` matches the date of `created_at`.

## 5. Implementation
| File | Change |
|---|---|
| `app/services/stock.py` (new) | `change_stock` (rule 10), `list_stock`, `list_low_stock`, `add_adjustment`, `list_stock_entries`, `build_stock_entry_out` |
| `app/services/deliveries.py` | `add_correction` uses `change_stock` instead of its own update. No behavior change: unit 6 tests must stay green |
| `app/routers/stock.py` (new) | `GET /stock`, `GET /stock/low`, `GET /stock-entries` |
| `app/routers/products.py` | Add `POST /products/{product_id}/adjustments` (thin, calls the stock service) |
| `app/schemas.py` | New section `# ---------- Store balance and adjustments ----------`: `StockLineOut`, `AdjustmentCreate`, `StockEntryOut`, `AdjustmentOut` |
| `app/main.py` | Register the stock router |
| `docs/api-plan.md` | `?group=` becomes `?group_id=` (rule 3) |
| `tests/test_stock.py` (new) | Tests below |

## 6. Invariants touched (docs/architecture.md section 4)
- **#1 stock never below 0:** removals use the guarded update in `change_stock`; the DB constraint is the backstop.
- **#2 all or nothing:** an adjustment (entry + stock change) is one transaction.
- **#5 history never edited:** adjustments are new rows; there is no edit or delete endpoint for stock entries.
- **#7 owner-only actions:** adjustments and the stock-entries history use `OwnerUser`.

## 7. Tests
`tests/test_stock.py`
- `test_stock_shows_every_active_sub_item_with_status`
- `test_stock_search_and_group_filter`
- `test_stock_hides_stopped_unless_asked`
- `test_low_stock_lists_out_first_then_low_and_skips_stopped`
- `test_stock_views_show_no_money` (no price keys for owner or shopkeeper)
- `test_owner_removes_damaged_stock_with_before_and_after`
- `test_counted_differently_can_add_stock`
- `test_damaged_expired_or_lost_cannot_add` (422 `reason_needs_remove`)
- `test_unknown_reason_or_bad_quantity_is_rejected`
- `test_adjustment_cannot_push_stock_below_zero` (409, nothing saved)
- `test_adjustment_allowed_on_stopped_sub_item`
- `test_unknown_sub_item_adjustment_is_404`
- `test_stock_entries_show_corrections_and_adjustments_newest_first`
- `test_stock_entries_filters` (product, kind, day)
- `test_shopkeeper_cannot_adjust_or_see_stock_entries` (403, stock unchanged)
- `test_must_be_logged_in_to_see_stock`
Plus: all unit 6 correction tests stay green after `add_correction` switches to `change_stock`.

## 8. Done checklist
- [ ] All 4 endpoints in section 3 work as described.
- [ ] Every test in section 7 exists and passes; full `pytest` green (73 old + new).
- [ ] Shopkeeper gets 403 on adjustments and on `/stock-entries`.
- [ ] Stock views contain no money fields.
- [ ] Corrections and adjustments share `change_stock`; unit 6 tests unchanged and green.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (unit Done, decisions, Next, test count).

## 9. Open questions (answered: all four recommendations accepted)
1. **Reasons.** Only the four fixed reasons, or also allow a free-text note ("3 bottles broke in the store")?
   Recommendation: only the four fixed reasons in Version 1. They match the API plan and the wireframe, and stay easy to count in reports later. A note can be added in a later version as its own column.
2. **Reason and direction.** Should `Damaged`, `Expired` and `Lost or missing` only be allowed to remove stock (rule 7)?
   Recommendation: yes. Goods cannot become "more damaged" into the store; adding stock back only makes sense after a recount.
3. **Stopped sub-items.** Hidden from `/stock` unless `?include_stopped=true`, and never in `/stock/low` (rule 4)?
   Recommendation: yes. Same as `GET /products`, and a warning for something you no longer sell is noise.
4. **Shared stock helper.** Move the guarded update into `change_stock` and make unit 6 corrections use it (rule 10)? This touches one function from unit 6.
   Recommendation: yes. Corrections and adjustments do exactly the same stock change; writing it once means a fix lands in one place. Unit 6 tests prove nothing breaks.
