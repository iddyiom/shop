# Redesign R3a: New sale in the mock-up's layout

Status: Done in the light and dark passes (2026-11-06, 22c0d60).
Depends on: R2a (cf62b01), R2b (572d4e0). Design reference: mock-up boards "New sale" and "New sale on a phone" (https://claude.ai/artifact/TfiWo6bhLsAiQEvjNVD5MZ, page "R2–R3 · Every page").

## 0. How R3 is split
R3 (each page in the mock-up's layout) is 8 pages, too big for one unit. One page (or a pair) per unit, most-used first:

| Unit | Page(s) | Main change |
|---|---|---|
| **R3a** | New sale | bill always in reach (bar on a phone), payment tiles, Confirm with its reason underneath |
| R3b | Sales records | dashboard: number cards, receipts list, chosen receipt beside it |
| R3c | Receive stock | lines as cards, "Stock after saving" preview |
| R3d | Restock history | delivery timeline, correction form card |
| R3e | Items and prices, Users | item cards with price history timeline; account rows and role tiles |
| R3f | Home | after R2c (photo and glass): stock-health ring, glass cards |

**Light pass result (2026-11-06):** Iddy chose to finish the whole look in light mode first, so R3b to R3f were built together in the light pass, from the agreed mock-up boards, without separate specs:
- R3b Sales records: number cards (Day total, owner only; Receipts with cash / mobile split; Units sold with the last sale time), counted from the receipts already loaded.
- R3c Receive: lines are cards at every width; "Stock after saving" is a glass card.
- R3d Restock: the list stacks above the delivery on a tablet; column headers may wrap.
- R3e Items: price history as a timeline. Users already had role tiles; its confirm card is glass.
- R3f Home: the stock-health ring (counted from GET /stock, active sub-items only).
Tests added: Sales records number cards, the stock-health ring (each broken on purpose and caught).

## 1. Goal
The shopkeeper's main job, a sale, follows the mock-up: the bill and the main button are always in reach (also on a phone), the payment choice is two big tiles, and a turned-off Confirm says why underneath instead of hiding the reason in the button's name. Problem 7 of the audit (r01 section 12).

## 2. Out of scope
- Any change to what is sent to the server (still only product ids, quantities and the payment method), the rules in f05, or the API.
- A pop-up bill sheet on a phone (question 2 picks the simpler bar + jump).
- Warning icons for OK / LOW / OUT (unit W1). Photo and glass (R2c).

## 3. Endpoints
None.

## 4. Rules and design decisions
1. **Confirm keeps its name; the reason moves under it.** The button always reads "Confirm sale". When it is turned off, the reason ("Choose how the customer paid", "Fix the red line to confirm", "Pick items to start") is a line under it, joined to the button with `aria-describedby`, so a screen reader hears "Confirm sale, dimmed, Choose how the customer paid". While saving it reads "Saving…".
2. **The bill is a normal card**, not the dark card: it matches the mock-up and takes the glass of R2c later. The bill head shows "N lines · N units".
3. **Payment is two tiles** (Cash, Mobile money) with an icon each, 64 px tall. They stay real radio buttons inside a fieldset, so keyboard and screen readers work as before.
4. **Item cards** show "N in bill" when the item is already in the bill, and a "None left" look when it is OUT (still disabled, as f05 rule 3).
5. **Phone (under 700 px): a bill bar fixed at the bottom of the screen** shows "N units · TSh total" and a **View bill** link that jumps to the bill. It shows only when the bill has lines. The page gets bottom padding so the bar never covers the last card.
6. The total keeps its words "Totals here are a preview. The server checks prices and stock again."
7. **The Receipt (end of the sale) joins R3a** (found in the browser during the light pass): it had no shared header row and its "Asante! Sale done." text sat straight on the photo. It gets the header ("Receipt" + "Saved. A receipt is never changed or deleted."), and the success message becomes a glass card (h2 "Asante! Sale done.", receipt number, the stock note). "Next customer" and "Done" keep their names.

## 5. Implementation
| File | Change |
|---|---|
| `frontend/src/pages/Sale.tsx` | Confirm name + reason line; bill head counts; "N in bill" on cards; payment tile icons; phone bill bar |
| `frontend/src/theme.css` | New sale section: bill card, tiles, card marker, phone bar; delete the old New sale rules these replace |
| `frontend/src/pages/Receipt.tsx` | rule 7: shared header, success card |
| `frontend/tests/sale.test.tsx` | the 3 tests that read the reason from the button's name read it from the line under it |
| new tests in `frontend/tests/sale.test.tsx` | section 7 |

## 6. Invariants touched
"The server recalculates all prices and totals" and "stock never below 0": unchanged. The request body is not touched, and its existing test (`the request contains only product_id, quantity and payment_method`) must still pass unchanged.

## 7. Tests
- `a turned-off Confirm keeps its name and is described by the reason under it`
- `the bill head counts lines and units`
- `an item already in the bill says how many on its card`
- `the phone bill bar shows units and total and links to the bill; it is hidden when the bill is empty`
- `the receipt has the shared header row titled Receipt and a success card`
- All existing New sale tests pass; the 4 that read the reason change on purpose (listed in the commit).

## 8. Done checklist
- [ ] Rules 1–6 true; tests in section 7 exist and each fails when its feature is broken on purpose.
- [ ] `npm test` and `npm run build` green; backend `pytest` still 117.
- [ ] Browser, light and dark, 375 and 1280 px: the bar never covers content; no sideways scroll; 0 tap targets under 44 px; a full sale works end to end on the throwaway API.
- [ ] Shopkeeper can sell; nothing owner-only appears.
- [ ] No file outside section 5 changed. docs/progress.md updated.

## 9. Open questions (answer before coding)
1. **Item cards: keep "tap the whole card to add one", or put − / + buttons on each card like the mock-up?** Recommendation: **keep tap-the-card**, and show "2 in bill" on it. The whole card is a big, fast target, and − / + already sit in the bill. Buttons inside a card-button are not allowed in HTML, so the mock-up's version means rebuilding every card (and its tests).
2. **Phone: "View bill" jumps down to the bill (simple), or opens the bill as a pop-up sheet over the items?** Recommendation: **jump**. It needs no new open/close state; a sheet can come later if the jump feels slow.
3. **The bill becomes a normal (light) card instead of the dark card?** Recommendation: **yes**. It matches the mock-up, and R2c turns every card into glass, which a dark card would fight.
