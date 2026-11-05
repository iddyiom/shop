# Unit 6: Deliveries

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: units 2 (models), 3 (auth), 5 (items and sub-items).

## 1. Goal
The owner or a shopkeeper records stock that arrives at the depot; every sub-item on the delivery goes up in one all-or-nothing step. The owner can also record the buying price per unit (hidden from shopkeepers), and fix a wrong delivery with a correction that keeps the original record.
User stories covered (docs/requirements.md section 5): #2 (record stock received), #11 (buying price), #12 (correct a wrong delivery; the stock adjustment half is unit 7).

## 2. Out of scope for this unit
- Stock adjustments for damaged, expired or lost goods (unit 7, `POST /products/{id}/adjustments`).
- `GET /stock-entries`, the history of corrections and adjustments (unit 7). Corrections are visible here inside `GET /deliveries/{id}`.
- Fixing a wrong **buying price**. History is never edited, and there is no correction for prices in Version 1. (Noted for later.)
- Profit reports (parked). Buying prices are only stored and shown to the owner.
- Suppliers, invoices, van stock.

## 3. Endpoints
| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| POST | /deliveries | owner, shopkeeper | 201, the delivery | 403 `owner_only_field`, 409 `item_stopped`, 422 `unknown_product`, 422 |
| GET | /deliveries | all | 200, list, newest first; `?day=YYYY-MM-DD` filter | 401 |
| GET | /deliveries/{delivery_id} | all | 200, the delivery with its corrections | 404 |
| POST | /deliveries/{delivery_id}/corrections | owner | 201, the correction | 403, 404, 409 `correction_too_big`, 409 `not_enough_stock`, 422 `not_on_delivery`, 422 |

### Examples

`POST /deliveries` (owner)
```json
{
  "delivered_at": "2026-11-05",
  "note": "Morning truck",
  "items": [
    { "product_id": 3, "quantity": 48, "buying_price": 800 },
    { "product_id": 7, "quantity": 24 }
  ]
}
```
-> 201
```json
{
  "id": 12,
  "delivered_at": "2026-11-05",
  "received_by": "Depot Owner",
  "note": "Morning truck",
  "items": [
    { "product_id": 3, "product": "Fanta", "quantity": 48, "buying_price": 800 },
    { "product_id": 7, "product": "Chocolate", "quantity": 24, "buying_price": null }
  ],
  "corrections": []
}
```

The same delivery read by a shopkeeper: identical, except **there is no `buying_price` key at all** in the items.

`POST /deliveries/12/corrections` (owner: 48 Fanta were recorded, but only 46 arrived)
```json
{ "product_id": 3, "quantity_change": -2, "reason": "Counted again, truck brought 46" }
```
-> 201
```json
{
  "id": 4, "delivery_id": 12, "product": "Fanta", "quantity_change": -2,
  "before": 53, "after": 51, "reason": "Counted again, truck brought 46",
  "by": "Depot Owner", "at": "2026-11-05T10:40:00"
}
```

## 4. Rules and design decisions
1. **All or nothing.** Every line is checked first (product exists, sub-item and its item are active, quantity > 0). Only then is stock increased for every line and the delivery saved, in one transaction. Any failure: nothing saved.
2. **Stock goes up with a database-side add:** `quantity_in_store = quantity_in_store + n`, not "read the number in Python, add, write back". *Why: if a sale happens at the same moment, a Python read-add-write could overwrite it and lose stock.*
3. **Buying price is owner-only, both ways.**
   - In: a shopkeeper who sends `buying_price` gets 403 `owner_only_field` and nothing is saved.
   - Out: shopkeepers get responses with no `buying_price` key (a different response schema, not just `null`).
4. **The delivery date** (`delivered_at`) defaults to today (East Africa Time). A past date is allowed (recording yesterday's truck). A future date is refused with 422.
5. **The same sub-item twice in one delivery** is allowed and kept as two lines (they may have different buying prices). Stock goes up by both.
6. **Stopped sub-items (or sub-items of a stopped item) cannot be received:** 409 `item_stopped`. Bring it back first.
7. **A correction** adds one `stock_entries` row (`kind = "correction"`, `delivery_id` set, who, when, reason) and changes stock by `quantity_change`, in one transaction. The delivery and its lines are never edited.
8. **Correction limits:**
   - `quantity_change` is a whole number, not 0, between -100,000 and 100,000. `reason` is required (1 to 500 characters, spaces trimmed).
   - The sub-item must be on that delivery, otherwise 422 `not_on_delivery`. (A product that arrived but was never recorded is a new delivery, not a correction.)
   - The line's net quantity (delivered + all its corrections) cannot go below 0: 409 `correction_too_big`.
   - Stock cannot go below 0 (some may already be sold): 409 `not_enough_stock`. Uses the same guarded update as sales.
9. **Corrections are allowed on stopped sub-items.** *Why: fixing the record is always allowed; only selling and receiving are blocked.*
10. **`GET /deliveries/{id}` shows its corrections**, newest first, so a reader sees the original lines and every fix.
11. **Note** is optional, at most 500 characters.

## 5. Implementation
| File | Change |
|---|---|
| `app/services/deliveries.py` (new) | `record_delivery`, `add_correction`, `build_delivery_out(delivery, for_owner)`, `list_deliveries`. Check-all-then-change-all, one commit each |
| `app/routers/deliveries.py` (new) | The 4 endpoints, thin. Picks the owner or shopkeeper response by role |
| `app/schemas.py` | New section `# ---------- Deliveries ----------`: `DeliveryLineIn`, `DeliveryCreate`, `DeliveryLineOut`, `DeliveryLineOwnerOut`, `DeliveryOut`, `DeliveryOwnerOut`, `CorrectionCreate`, `CorrectionOut` |
| `app/models.py` | Relationships only, no table change: `Delivery.receiver`, `StockEntry.product`, `StockEntry.creator`, `Delivery.corrections` |
| `app/main.py` | Register the router |
| `tests/test_deliveries.py` (new) | Tests below |

## 6. Invariants touched (docs/architecture.md section 4)
- **#1 stock never below 0:** negative corrections use the guarded update; the DB constraint is the backstop.
- **#2 all or nothing:** a delivery is one transaction; so is a correction.
- **#5 history never edited:** deliveries and delivery_items are only inserted; corrections are new `stock_entries` rows.
- **#7 owner-only actions:** corrections use `OwnerUser`.
- **#8 owner-only fields never reach a shopkeeper:** first time this is enforced. Tested on POST, GET list and GET one.

## 7. Tests
`tests/test_deliveries.py`
- `test_delivery_increases_stock_for_every_line`
- `test_shopkeeper_records_delivery_and_is_shown_as_receiver`
- `test_delivery_is_all_or_nothing` (one bad line: no stock changes, no delivery saved)
- `test_unknown_product_is_rejected`
- `test_stopped_sub_item_or_item_cannot_be_received`
- `test_quantity_zero_or_negative_is_rejected`
- `test_same_sub_item_twice_adds_both_lines`
- `test_date_defaults_to_today_past_allowed_future_refused`
- `test_owner_records_buying_price`
- `test_shopkeeper_cannot_send_buying_price` (403, nothing saved)
- `test_shopkeeper_never_sees_buying_price` (POST, list and one: no `buying_price` key anywhere)
- `test_list_deliveries_newest_first_and_by_day`
- `test_unknown_delivery_is_404`
- `test_correction_changes_stock_and_keeps_original_lines`
- `test_correction_needs_a_reason`
- `test_correction_product_must_be_on_the_delivery`
- `test_correction_cannot_take_more_than_was_delivered`
- `test_correction_cannot_push_stock_below_zero` (some already sold)
- `test_correction_shows_in_delivery_detail`
- `test_shopkeeper_cannot_correct_a_delivery` (403)

## 8. Done checklist
- [ ] All 4 endpoints in section 3 work as described.
- [ ] Every test in section 7 exists and passes; full `pytest` green (52 old + new).
- [ ] Shopkeeper gets 403 on corrections and when sending a buying price.
- [ ] No response to a shopkeeper contains a `buying_price` key.
- [ ] No code edits or deletes a delivery, delivery line or stock entry.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (unit Done, decisions, Next, test count), and invariant #8 in docs/architecture.md names its tests.

## 9. Open questions (answered: all four recommendations accepted)
1. **Shopkeeper sends a buying price.** Refuse the whole delivery with 403, or save the delivery and silently drop the price?
   Recommendation: refuse with 403. The shopkeeper's screen has no such field, so receiving one means something is wrong; silently dropping it hides the problem.
2. **Corrections only for sub-items on that delivery?** Or allow adding a forgotten sub-item through a correction?
   Recommendation: only sub-items on the delivery. A forgotten product is recorded as a new delivery, which keeps "correction" meaning "fix a number".
3. **Delivery date.** Default today, allow past dates, refuse future dates?
   Recommendation: yes. The truck sometimes comes before the paperwork is entered, but nothing can arrive tomorrow.
4. **Same sub-item twice in one delivery.** Keep two lines (allow), merge into one, or refuse?
   Recommendation: keep two lines. Two cartons of Fanta may come at different buying prices.
