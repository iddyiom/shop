# Depot Management System: Requirements (Version 1)

Status: Phase 1 (Requirements) updated after Phase 2 (Design) wireframes. Matches database-design.md and api-plan.md.

## 1. Problem Statement
A depot owner who distributes a company's products tracks stock received, sales, van supplies and profits by hand, which makes it hard to know what is in the store, what was sold, and when to restock. We will build a system that records incoming stock, handles multi-product sales with correct prices and receipts, and shows the store balance.

## 2. Users and Roles
| Role | Description |
|---|---|
| Owner | Runs the depot. Full access, including everything a shopkeeper can do (the owner can also work the counter and sell). |
| Shopkeeper | Staff who sells and helps receive stock. Limited access. |

Buyers (not system users): shops (retailers) and regular customers. Both pay the same price.

## 3. Persona
**The depot owner.** Distributes one company's products from a depot, plus a van for deliveries. Wants to know stock, sales and profit at any moment. Does not want to calculate by hand: picks products and quantities, and the system shows prices and totals instantly.

## 4. Words used in this project
- **Item** (product group): Soda, Biscuit, Water ndogo, Water kubwa. The owner can add new items.
- **Sub-item** (product): the flavors or kinds inside an item, e.g. Fanta, Coca-Cola, Chocolate. The owner can add new sub-items.
- **Price**: set on the item. A sub-item may have its own price; if it does not, it uses the item price.

## 5. Version 1 User Stories
1. As the owner or a shopkeeper, I want to log in, so only authorized people use the system.
2. As the owner or a shopkeeper, I want to record stock received, so I know quantities in the store.
3. As the owner, I want to add items and sub-items and set their prices, so the system follows what I really sell.
4. As the owner, I want to change a price (with a confirmation step), so the system follows the market and I do not change it by accident.
5. As a shopkeeper, I want to sell several products in one sale, so one customer gets one bill.
6. As a shopkeeper, I want totals calculated automatically as I enter quantities, so I never do math by hand.
7. As a shopkeeper, I want the system to block a sale when stock is not enough, so we never sell what we do not have.
8. As a shopkeeper, I want to record whether the customer paid cash or mobile money, so payments are tracked.
9. As a shopkeeper, I want a receipt for each sale, so there is a record of what was sold.
10. As the owner or a shopkeeper, I want to see the store balance and low-stock warnings, so I know when to restock.
11. As the owner, I want to record the buying price when stock arrives, so profit reports can come later.
12. As the owner, I want to correct a wrong delivery and adjust stock for damaged, expired or lost goods, with a reason, so the balance matches the real store without erasing history.
13. As the owner, I want to stop selling a sub-item and bring it back later, so old records stay and old stock is not lost.

## 6. Permissions (Version 1)
| Action | Owner | Shopkeeper |
|---|---|---|
| Log in | Yes | Yes |
| Record sales and view receipts | Yes | Yes |
| Receive stock (quantities) | Yes | Yes |
| View store balance and low-stock warnings | Yes | Yes |
| See money totals (sales today in TSh), buying prices, reports | Yes | No |
| Enter buying price on a delivery | Yes | No |
| Change prices | Yes | No |
| Add or edit items and sub-items, stop selling or bring back | Yes | No |
| Correct a delivery | Yes | No |
| Adjust stock (damaged, expired, lost, counted differently) | Yes | No |
| Add users, unlock locked accounts | Yes | No |

Rule: the Owner role includes all Shopkeeper permissions. The Shopkeeper role is a subset of the Owner role.

## 7. Business Rules
- Line total = quantity x unit price. Bill total = sum of all line totals.
- Unit price = the sub-item's own price if it has one, otherwise the item price.
- A sale is blocked if any quantity exceeds available stock. The message is "Item not available" when stock is 0, and "Item over: only N in store" when the quantity is more than what is left. The screen checks first, and the server checks again.
- Each confirmed sale reduces stock automatically.
- Prices change over time. A receipt always keeps the price at the time of sale (price history).
- Changing a price asks the owner to confirm, and shows old and new price.
- Payment method is recorded as cash or mobile money (no real mobile money integration in Version 1).
- A low-stock warning appears when a product is at or below its low-stock level. Stock of 0 shows as OUT.
- Stock arrives on irregular days; each delivery records its date.
- Corrections and adjustments never edit or delete history. They add a new entry with who, when and a required reason.
- Stopping a sub-item keeps its stock and history. Bringing it back restores the old stock. A brand-new sub-item starts at 0.
- Nothing is hard-deleted.
- Login: after 3 wrong tries in total the account is locked. The message is "Wrong username or password" with the number of tries remaining. The owner unlocks the account.
- Receipts are the depot's own sales receipt shown on screen. Printing is not part of Version 1.

## 8. Non-Functional Requirements
- Totals update instantly as quantities are entered (no extra button, no waiting).
- Works on a phone screen as well as a computer.
- Only logged-in users can access any data.
- Records (sales, stock movements) are never silently lost or altered.
- The server never trusts totals or prices sent by the screen.

## 9. Main User Journey
Log in -> choose products -> enter quantities -> totals appear instantly -> choose payment method -> confirm sale -> stock reduces -> receipt shown -> (later) view balance.

## 10. Acceptance Criteria (examples, become tests later)
- Selling 2 items priced 1,000 each shows a line total of 2,000.
- A bill with several products shows the correct sum.
- A sub-item with its own price uses that price; others use the item price.
- Selling a product with stock 0 is rejected with "Item not available".
- Selling more than what is left is rejected with "Item over: only N in store".
- After a price change, old receipts still show the old price.
- A shopkeeper cannot change prices, see buying prices, correct deliveries or adjust stock.
- The owner can record a sale just like a shopkeeper, and the sale shows who made it.
- After a confirmed sale, the store balance is reduced by the quantity sold.
- An adjustment of -2 on Fanta (5 in store) leaves 3 and adds an entry with reason, user and date.
- A stopped sub-item cannot be sold; after "Bring back" it has its old stock.
- A 3rd wrong password locks the account until the owner unlocks it.

## 11. Out of Scope for Version 1 (planned later)
- Mobile van stock tracking
- Profit reports (the buying price is recorded now so reports can come later)
- Customer credit (debts, shown as "Version 2")
- Real mobile money integration
- Multiple depots
- Expenditure (usage) tracking
- Receipt printing
- Tax authority (TRA) fiscal receipts
