# Unit 5: Items and sub-items

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: units 2 (models), 3 (auth). Unit 4 (sales) already reads prices and `is_active`.

## 1. Goal
The owner can manage what the depot sells from the API: add items and sub-items, set and change prices (keeping price history), and stop or bring back an item or sub-item. Everyone logged in can list them with the price that will be charged.
User stories covered: #3 (add items, sub-items, prices), #4 (change a price), #13 (stop selling and bring back).

## 2. Out of scope for this unit
- Changing stock. Stock only changes through sales (unit 4), deliveries (unit 6) and adjustments (unit 7). No endpoint here accepts a quantity.
- Moving a sub-item to another item.
- The `/stock` and `/stock/low` views (unit 7). `GET /products` shows stock and status, but search and low-only filters come in unit 7.
- The confirmation screen for price changes. The screen asks "change 1,000 to 1,200?"; the server simply applies the change and returns old and new price.

## 3. Endpoints

### Items (product groups)
| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| GET | /groups | all | 200, list of items | 401 |
| POST | /groups | owner | 201, the new item | 403, 409 `name_taken`, 422 |
| PATCH | /groups/{group_id} | owner | 200, the item | 403, 404, 409 `name_taken`, 422 |
| PUT | /groups/{group_id}/price | owner | 200, old and new price | 403, 404, 422 |
| GET | /groups/{group_id}/price-history | owner | 200, list, newest first | 403, 404 |

### Sub-items (products)
| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| GET | /products | all | 200, list of sub-items | 401 |
| POST | /products | owner | 201, the new sub-item | 403, 409 `name_taken`, 409 `item_stopped`, 422 `unknown_item` |
| PATCH | /products/{product_id} | owner | 200, the sub-item | 403, 404, 409 `name_taken`, 422 |
| PUT | /products/{product_id}/price | owner | 200, old and new price | 403, 404, 422 |

### Examples

`POST /groups`
```json
{ "name": "Juice", "price": 1200 }
```
-> 201 `{ "id": 5, "name": "Juice", "current_price": 1200, "is_active": true }`

`PUT /groups/1/price`
```json
{ "price": 1200 }
```
-> 200 `{ "old_price": 1000, "new_price": 1200, "changed": true }`

`POST /products`
```json
{ "group_id": 1, "name": "Pepsi", "own_price": null, "min_level": 6 }
```
-> 201
```json
{
  "id": 9, "name": "Pepsi", "group_id": 1, "group": "Soda",
  "own_price": null, "effective_price": 1000,
  "quantity_in_store": 0, "min_level": 6, "stock_status": "OUT", "is_active": true
}
```

`PUT /products/4/price` with `{ "price": null }` -> 200 `{ "old_price": 1500, "new_price": null, "changed": true }` (the sub-item now uses the item price).

`GET /groups/1/price-history` -> 200
```json
[
  { "target": "sub-item", "name": "Fanta", "price": 1100, "changed_at": "...", "changed_by": "Depot Owner" },
  { "target": "item", "name": "Soda", "price": 1200, "changed_at": "...", "changed_by": "Depot Owner" }
]
```

## 4. Rules and design decisions
1. **Prices only change through the `/price` endpoints.** `PATCH` cannot change a price, so every price change always writes `price_history`. *Why: one door for prices means history can never be skipped.*
2. **Every price change adds one `price_history` row** (who, when, new price) in the same transaction as the change. Old `sale_items` are never touched.
3. **Creating also writes history:** a new item writes its first price; a new sub-item with an `own_price` writes it too. *Why: history then shows every price an item ever had, from day one.*
4. **Setting the same price again changes nothing:** no history row, response `"changed": false`. *Why: no noise in history from double clicks.*
5. **Names:** spaces trimmed, 1 to 100 characters. Item names are unique (ignoring upper/lower case). Sub-item names are unique inside their item. Duplicate -> 409 `name_taken`.
6. **Prices** are whole TSh, 0 or more, at most 10,000,000.
7. **A new sub-item starts at stock 0**, `min_level` defaults to 0.
8. **Stop / bring back** is `PATCH` with `is_active`. Nothing is deleted.
   - Stopping a sub-item keeps its stock; bringing it back shows the same stock.
   - Stopping an item makes all its sub-items unsellable (sales already checks this) without changing each sub-item's own `is_active`. Bringing the item back restores them exactly as they were.
   - A sub-item cannot be added to a stopped item: 409 `item_stopped`.
9. **Fields that do not belong are ignored** (same as sales). Sending `quantity_in_store` in `PATCH /products` does nothing to stock.
10. **Shopkeepers can read items, sub-items and selling prices** (they need them to sell). Price history is owner-only.
11. **Lists show active ones only by default.** `?include_stopped=true` shows stopped ones too. `GET /products` also accepts `?group_id=`. A sub-item counts as stopped when it or its item is stopped.

## 5. Implementation
| File | Change |
|---|---|
| `app/services/catalog.py` (new) | `create_group`, `update_group`, `set_group_price`, `create_product`, `update_product`, `set_product_price`, `price_history_for_group`. Name checks, history rows, one commit each |
| `app/routers/groups.py` (new) | The 5 `/groups` endpoints, thin |
| `app/routers/products.py` (new) | The 4 `/products` endpoints, thin |
| `app/schemas.py` | New section `# ---------- Items and sub-items ----------`: `GroupCreate`, `GroupUpdate`, `GroupOut`, `ProductCreate`, `ProductUpdate`, `ProductOut`, `PriceSet`, `PriceChangeOut`, `PriceHistoryOut` |
| `app/main.py` | Register the two routers |
| `tests/test_groups.py` (new) | Tests for items |
| `tests/test_products.py` (new) | Tests for sub-items |

No change to `app/models.py`: all needed tables and constraints already exist.

## 6. Invariants touched (docs/architecture.md section 4)
- **#3 server calculates prices:** `effective_price` in `ProductOut` comes from the model property, the same one sales uses.
- **#4 receipts keep old prices:** price changes never touch `sale_items`. Tested again here.
- **#5 history never edited:** only inserts into `price_history`. No endpoint edits or deletes it.
- **#6 nothing hard-deleted:** there is no DELETE endpoint.
- **#7 owner-only:** every write endpoint and price history use `OwnerUser`.

## 7. Tests
`tests/test_groups.py`
- `test_owner_adds_item_and_first_price_is_in_history`
- `test_item_name_must_be_unique_ignoring_case`
- `test_list_items_for_shopkeeper`
- `test_owner_renames_item`
- `test_change_item_price_returns_old_and_new_and_adds_history`
- `test_same_price_again_adds_no_history`
- `test_negative_or_missing_price_is_rejected`
- `test_old_receipt_keeps_old_price_after_item_price_change`
- `test_stop_item_blocks_selling_and_bring_back_restores`
- `test_price_history_includes_sub_items_newest_first`
- `test_shopkeeper_cannot_add_rename_reprice_or_see_history` (403 on each)
- `test_unknown_item_is_404`

`tests/test_products.py`
- `test_owner_adds_sub_item_starting_at_zero_stock`
- `test_sub_item_without_own_price_uses_item_price`
- `test_sub_item_name_unique_inside_item_only` (Fanta twice in Soda -> 409; "Water ndogo" item and sub-item -> fine)
- `test_cannot_add_sub_item_to_unknown_or_stopped_item`
- `test_set_own_price_then_remove_it` (history gets both rows, removal stored as null)
- `test_patch_cannot_change_stock_or_price`
- `test_stop_sub_item_keeps_stock_and_bring_back_restores_it`
- `test_list_products_shows_effective_price_and_status`
- `test_shopkeeper_cannot_add_edit_or_reprice_sub_item` (403 on each)

## 8. Done checklist
- [ ] All 9 endpoints in section 3 work as described.
- [ ] All tests in section 7 exist and pass; full `pytest` green (29 old + new).
- [ ] Shopkeeper gets 403 on every owner-only endpoint.
- [ ] Every price change, including the first price, has exactly one `price_history` row.
- [ ] No endpoint can change stock.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (unit Done, decisions, Next, test count).

## 9. Open questions (answered: all four recommendations accepted)
1. **Stopped items in lists.** Should `GET /groups` and `GET /products` show stopped ones?
   Recommendation: show only active ones by default; `?include_stopped=true` shows all (the owner's "Items and prices" screen needs them to bring them back).
2. **Price history of sub-items.** The API plan only has `/groups/{id}/price-history`. Should it include the own-price changes of that item's sub-items?
   Recommendation: yes, as in the example above. One screen shows the whole history of "Soda", and we avoid a second endpoint.
3. **Same price again.** OK to answer 200 with `"changed": false` and no history row (rule 4)?
   Recommendation: yes.
4. **Unit size.** This unit has 9 endpoints. Keep it as one unit, or split into 5a (items) and 5b (sub-items)?
   Recommendation: keep as one. The two halves share the service and the price rules, and splitting would mean writing the price code twice.
