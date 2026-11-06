# Redesign R2: shared pieces (split into R2a and R2b)

Status: Agreed 2026-11-06 (all 3 recommendations accepted). R2a Done (cf62b01). R2b agreed, in progress.
Depends on: R1 (Done, 9c75089). Design reference: the mock-up page "R2–R3 · Every page" (https://claude.ai/artifact/TfiWo6bhLsAiQEvjNVD5MZ), mainly the "Design system" board. Problems and fixes: docs/specs/r01-redesign.md section 12.

## 1. Goal
Every page uses the same pieces the design system sheet shows: one header row, three button levels, badges vs tags, fields, lists that fit a phone, and designed loading / empty states. Fix each problem **once, in a shared piece**, so all 8 pages improve together.

R2 is too big for one session, so it is split:
- **R2a: looks only (CSS + font).** Same class names, new rules in `theme.css`. No `.tsx` markup changes, so every existing test keeps passing unchanged.
- **R2b: shared components.** Header title = menu name, empty / loading pieces, tables that become cards on a phone. Small markup changes in each page, and some tests change on purpose.

## 2. Out of scope
- Page layouts (New sale bill bar, Sales records dashboard cards, Receive line cards, etc.): R3.
- Warning icons for LOW / OUT: unit W1 (r01 section 10).
- The pear accent: not decided (r01 section 12).
- Any API, rule or backend change.

## 3. Endpoints
None. Front end only.

## 4. Rules and design decisions
1. **Same class names, new looks (R2a).** Like R1 changed token values, R2a restyles the existing classes, so pages change look without changing markup. The map:

| Level (design sheet) | Existing classes restyled |
|---|---|
| Filled main button, 48 px (one per screen) | `primary-button`, `primary-link`, `dark-button` |
| Outlined button, 44 px | `pill-button`, `ghost-button`, `link-pill`, `action-pill`, `chip-button` (chosen chip is filled) |
| Underlined small link, 44 px tap area | `text-button`, `text-link`, `icon-link` |
| Turned off | every `button:disabled`: dashed border, flat, muted text (4.5:1 checked) |
| Status badge (filled, dot + word) | `badge`, `badge-ok/low/out`, `state-tag` |
| Info tag (outlined) | `stat-pill` ("Owner only") |
| Field: label above in sentence case, 48 px input, help / error below | `field`, `field-hint`, `field-problem`, `search-input`, `small-input` |

2. **No capital labels.** The 7 `text-transform: uppercase` rules become sentence case (13–14 px, weight 600). Screen readers and tests read the same words.
3. **Tap targets at least 44 px** for every button, link-button, chip and tab (CSS `min-height: 44px`).
4. **Fonts.** Headings h1–h3 use Plus Jakarta Sans; text and all numbers stay Inter with `tabular-nums`. Installed from npm (`@fontsource-variable/plus-jakarta-sans` 5.3.0, pinned), so the app still works without internet.
5. **R2b header rule.** The h1 is the page's menu name, taken from `menu.ts` (the one list). The friendly sentence ("What is in the store") moves into the muted line under it. New sale and Receipt keep their own names ("New sale", "Receipt").
6. **R2b lists.** `.data-table` on a narrow screen (under 700 px) shows each row as a card: each cell carries `data-label`, shown before its value. No `table-scroll` sideways box on a phone.
7. **R2b states.** `Panel` and page loading show grey skeleton lines inside the frame (menu and header stay). A new `EmptyState` (icon, sentence, optional action) replaces the bare "No … yet" lines.
8. Contrast stays 4.5:1 for text, 3:1 for borders and the dashed turned-off border, in both themes (checked in the browser).

## 5. Implementation
**R2a**
| File | Change |
|---|---|
| `frontend/package.json`, `package-lock.json` | + `@fontsource-variable/plus-jakarta-sans` 5.3.0 |
| `frontend/src/main.tsx` | import the font (one line) |
| `frontend/src/theme.css` | Base (h1–h3 font), Buttons, Badges, Forms, uppercase rules, 44 px targets, disabled look |

**R2b**: see section 11.

## 6. Invariants touched
None of the business rules. Owner-only parts are decided in `.tsx`; R2a changes no `.tsx` except `main.tsx`. Browser check: a shopkeeper still sees no owner-only parts.

## 7. Tests
- R2a: all 158 existing front-end tests pass unchanged (proof the markup did not change); `npm run build` green.
- R2a browser checks (screenshots, light and dark, 375 and 1280 px): buttons have 3 looks; no capital labels; every tap target at least 44 px (measured with a script); disabled buttons look off; text contrast at least 4.5:1 (measured).
- R2b: listed in its own section when R2a is done.

## 8. Done checklist (R2a)
- [x] The button, badge, tag and field looks match the Design system board in both themes (screenshots: Items, New sale, Restock, Users).
- [x] No capital labels from CSS: the 7 `uppercase` rules and R1's dark-mode capital card titles are overridden.
- [x] Script check: 0 tap targets under 44 px on all 8 pages, at 375 and 1280 px, light and dark (the check found round icon buttons at 40 px and the Store balance tabs at 34 px; both fixed).
- [x] Headings in Plus Jakarta Sans (measured on all 8 pages), numbers in Inter with even digits.
- [x] Turned-off buttons measured: text contrast 4.7 to 15 : 1.
- [x] 158 front-end tests pass unchanged, `npm run build` green, backend `pytest` still 117 (no backend change).
- [x] Shopkeeper still sees no owner-only parts (browser, throwaway API): Work group only, no buying price, no correction form.
- [x] No file outside the R2a rows changed. docs/progress.md updated.

### Carried to R2b (found while checking R2a)
- Receive stock is still 681 px wide on a phone: its line table needs the table-to-cards change.
- Words written in capitals in the markup or data: "NEVER EDITED", "STOPPED" (shown in small letters for now) and the account badges ACTIVE / LOCKED / DEACTIVATED in `users.ts` (tests look for them).
- Users' "Deactivate" button uses `dark-button`; it should get the red outline (take away access).
- The R2a section overrides older rules. When R2b/R3 touch a section, delete the old rule it replaces, so `theme.css` does not keep dead lines.

## 9. Open questions (answer before coding)
1. **Split R2 into R2a (looks only) and R2b (components)?** Recommendation: yes. R2a cannot break any test, and it is small enough to finish and check in one session.
2. **Add the npm package `@fontsource-variable/plus-jakarta-sans` 5.3.0?** Recommendation: yes. It is the font you chose, served from our own app (no Google call), same as Inter today.
3. **R2b changes the page titles to the menu names** (for example "Every receipt" becomes "Sales records", and "Every receipt" moves to the line under it). Some tests change on purpose. Recommendation: yes; it fixes problem 2 (people lose track of where they are).

## 10. R2c: photo behind every page, glass blocks (added 2026-11-06, Iddy's choice)
Planned after R2b; its own spec section gets the full detail and checklist before coding.
- The frame (`Layout.tsx`) shows one photo behind every page, `position: fixed`, under a soft veil. Light: Kilimanjaro (`public/login-kilimanjaro.jpg`). Dark: the lone tree under a red moon. Log in keeps its own photo.
- Cards, panels, the menu and the header chips become frosted glass: see-through `--card` colors plus `backdrop-filter: blur()`. Thin glass for number cards, thick glass for lists and forms. Mostly new token values, like R1.
- Phones: the blur is costly on cheap phones, so under 700 px the glass is more solid and the blur smaller. People who choose "reduce transparency" get solid cards.
- Before coding: a larger tree photo (at least 1600 px wide; the given one is 643 x 360) and confirmation both photos may be used. Contrast measured on the real photos in both themes.

## 11. R2b in detail (Agreed 2026-11-06; built and checked, not committed yet)

### 11.1 Rules and decisions
1. **Header: the h1 is the page's name, the browser tab the same.** `PageHeader` takes `title` (the name) and `subtitle` (the friendly sentence); the tab uses the title, so `tabTitle` is only passed by Home (its title is the greeting). Names:

| Page | h1 (and tab) | Line under it (was the h1) |
|---|---|---|
| Home | Habari, <name> (unchanged: a greeting, tab "Home") | the date |
| Receive stock | Receive stock | The truck came. Write down what arrived. |
| Store balance | Store balance | What is in the store. Counts change only through sales, deliveries and fixes. |
| Sales records | Sales records | Every receipt, by day. Receipts are never changed or deleted. |
| Restock history | Restock history | Past deliveries, newest first. Lines are never edited. |
| Items and prices | Items and prices | What you sell. A sub-item uses its item's price unless it has its own. |
| Users | Users | Who can log in. Accounts are never deleted. |
| New sale | New sale | Tap an item to add it. The server checks prices and stock again. |
| Adjust stock | Adjust stock | Fix the count. Never edited, only added. |
| Receipt, item and sub-item forms, Not found, Owner only | keep their names (they are not in the menu) | unchanged |

2. **New sale header sits above both columns** (it was inside the left column, so the theme button and user wrapped under the title). The "← Back to home" link goes: Home is in the menu.
3. **Words in sentence case:** "NEVER EDITED" becomes "Never edited", "SELLING" / "STOPPED" become "Selling" / "Stopped", account badges ACTIVE / LOCKED / DEACTIVATED become Active / Locked / Deactivated. OK / LOW / OUT stay as they are (the warning-icons unit W1 changes them). The R2a "lowercase" CSS for tags is removed.
4. **"Deactivate" gets the red outline** (new class `danger-button`): it takes away access, like the design sheet says.
5. **Loading:** a new `Skeleton` shows 3 grey lines where the content will be. It keeps `role="status"` and a hidden "Loading…" text, so screen readers (and tests) still hear "Loading…".
6. **Empty:** a new `EmptyState` shows an icon, the same sentence as today, and an optional next step (Home "No sales yet today" offers **New sale**; Restock "No deliveries yet" offers **Receive stock**; Sales records "No sales on this day" offers **New sale**). The sentence does not change, so tests still find it.
7. **Tables become cards on a phone (under 700 px):** every `td` gets `data-label` ("In store", "Delivered"…). CSS turns each row into a card and writes the label before the value. The `table-scroll` sideways box only works on a laptop. Tables: Store balance, Restock history, Sales records, Receive stock (lines). The Receipt stays a table: its 4 short columns fit a 375 px phone, and a receipt reads best as one.
8. **Clean-up:** where R2b touches a CSS section, the old rule that R2a overrides is deleted, so `theme.css` keeps no dead lines for those sections.

### 11.2 Out of scope (R2b)
- The start-up check screen (full-screen "Loading…" while the app asks who is logged in): it is the app starting, not a page. Noted for R3.
- Page layouts from the mock-up (bill bar, dashboard cards, line cards for Receive): R3. R2b only makes the existing tables fit.
- Photo and glass: R2c.

### 11.3 Files
| File | Change |
|---|---|
| `components/PageHeader.tsx` | `title` + `subtitle`; tab = title |
| new `components/Skeleton.tsx`, new `components/EmptyState.tsx` | loading and empty pieces |
| `components/Panel.tsx` | uses `Skeleton` |
| `pages/*.tsx` (all with a header, a table, a "Loading…" or an empty sentence) | new header props; `data-label`; `Skeleton`; `EmptyState`; New sale header above the columns |
| `users.ts` | badge words in sentence case |
| `theme.css` | tables-to-cards, skeleton, empty state, `danger-button`; delete superseded old rules in those sections |
| tests: `auth`, `shell`, `home`, `items`, `records`, `stock`, `users`, `users-rules` | titles are menu names; new badge words |

### 11.4 Tests (new ones)
- `every menu page's h1 and browser tab are its menu name` (owner, each menu entry)
- `the old friendly title is now the line under the h1` (Store balance)
- `new sale: the header is outside both columns and there is no back link`
- `loading shows the skeleton and still says Loading to screen readers`
- `an empty list shows its sentence and its next step` (Home: New sale link)
- `every store balance cell has a data-label matching its column header`
- `account badges read Active, Locked, Deactivated`
- `deactivate is a danger button`

### 11.5 Done checklist (R2b)
- [x] Every row in 11.1 is true; all tests in 11.4 exist (13 in `tests/r2b.test.tsx`; the header test runs once per menu page), and each of the 8 features was broken on purpose and caught.
- [x] Full `npm test` green (171), `npm run build` green, backend `pytest` still 117 (no backend change).
- [x] Browser, 375 and 1280 px, light and dark: no page scrolls sideways (Receive was 681 px, now fits); 0 tap targets under 44 px; tables read as cards on a phone.
- [x] Found in the browser and fixed: Store balance cut its rows off. Panels have `flex: 1 1 320px` ("about 320 px wide" in a row); inside the Store balance column that 320 px became a height. Fix: `.stock-main > .table-card { flex: 0 0 auto }`. A script now checks every page for any box hiding content it cut off: none.
- [x] Shopkeeper (throwaway API): no Owner group, no buying price, no Adjust, no correction form, no day total.
- [x] No file outside 11.3 changed. docs/progress.md updated.

### 11.6 Open questions (answer before coding)
1. **Home keeps "Habari, <name>" as its h1** instead of "Home"? Recommendation: yes. It is the dashboard's greeting from your PDF; the menu and the tab still say Home, so nobody is lost.
2. **Remove "← Back to home" from New sale?** Recommendation: yes. Home is in the menu, and the bill is easier to reach with one less line at the top. After a sale, the Receipt offers "Next sale" and "Back to home".
