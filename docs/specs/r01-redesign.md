# Redesign R1–R3: a new look (shadcn ideas, Vanilla and black-and-white themes)

Status: R1 reworked to match the mock-up PDF (section 11), built and checked 2026-11-06, committed in 9c75089. R0 (mock-up) Done. The 4 questions were accepted on 2026-11-06, and Iddy changed the look in the mock-up the same day (section 3).
Depends on: Phase 4 complete (F1–F10).
Mock-up (approved shapes and colors): https://claude.ai/artifact/TfiWo6bhLsAiQEvjNVD5MZ (private to Iddy).

## 1. Goal
Give every screen a new look. It started from the shadcn/ui blocks (`dashboard-01`, `sidebar-07`, `login-03`) and was then changed by Iddy in the mock-up (section 3). **What the screens do stays the same.** Only how they look changes, plus the menu, which can now collapse and pop up.

## 2. Out of scope
- **Solid warning icons for LOW / OUT** (⚠️ / ⛔ style, OUT pulsing). Iddy parked them on 2026-11-06 for a later unit. Section 10 lists what that unit must change.
- Charts and trend percentages. The API sends no trends, and reports are parked for Version 2.
- Any change in rules or API calls. Backend changes.

## 3. What changed in the mock-up (Iddy's decisions, 2026-11-06)
| Decision | Replaces | Unit |
|---|---|---|
| **Light theme "Vanilla":** warm cream page, white cards, espresso text and main buttons, caramel highlights | Sage | R1 |
| **Dark theme "Black and white"** (inspired by a product showcase): black page, charcoal panels, white text and white main buttons. Only warnings keep a color. | Deep Blue, and the mauve tried in between | R1 |
| **Log in on a photo:** Iddy's Kilimanjaro photo fills the page, with a darker gradient at the bottom. A centred frosted-glass card with the heading and the form, and a strip of the depot's real promises at the bottom. It looks the same in both themes, because the photo does not change. | Plain card | R1 |
| **Menu:** icons + labels, the user at the bottom. On a laptop it **collapses to an icon rail** (round buttons, the current page filled). On a phone it **pops up as a drawer** over a dark layer. | Green menu | R1 |
| **Inter only.** Bold headings, smaller than before. | Montserrat headings | R1 |
| **Bigger rounded panels and pill buttons.** | 28–40px blobs | R2 |
| **Home as a standard dashboard:** a greeting with the main actions (New sale first), 4 number cards, then Latest sales next to Needs restocking. Only numbers the API already sends. | Current Home | R3 |

## 4. Rules and design decisions
1. **Same token names, new values.** Every color still comes from `var(--name)` in `theme.css`. R1 changes only the values (Sage → Vanilla, Deep Blue → Black and white), so every page takes the new colors at once, even before R2 and R3 reshape it.
2. **Names stay.** Menu links, buttons and headings keep their accessible names ("Store balance", "Log out", "Dark mode", "Karibu"). Tests find things by name, so they keep working.
3. **Icons are decoration.** Every icon is `aria-hidden`. When the menu is collapsed, the label text is still there, hidden visually like `.sr-only`, so screen readers and `textContent` still read "Store balance". The label also shows as a tooltip (`title`).
4. **Collapse is remembered** on this browser (`localStorage` key `depot-menu`). It is only a screen preference, like the theme, never data. Blocked storage means it is simply not remembered.
5. **Phone width (under 700px):** the rail and collapse button are hidden. A "Open menu" button shows the menu as a drawer. Choosing a page, tapping the dark layer, the "Close menu" button or Escape closes it. A closed drawer cannot be reached with Tab.
6. **The top bar names the current page** ("Store balance", "New sale", "Receipt"), taken from one list in `menu.ts`.
7. **The login photo** is Iddy's file, served from `frontend/public/login-kilimanjaro.jpg`. Before the depot's real launch, Iddy confirms the photo may be used (section 10).
8. **Contrast:** text stays at 4.5:1 or better in both themes (checked in the browser for each unit).

## 5. Implementation
| Unit | Files | What changes |
|---|---|---|
| **R0 Mock-up** | design artifact | Done: Home (light, dark, phone), Store balance, Log in |
| **R1 Shell and colors** | `theme.css` (tokens, Base, Shell, Log in, Phone width, every `Montserrat`), `main.tsx` (fonts), `package.json` (+`lucide-react` 1.61.0, −`@fontsource/montserrat`), `menu.ts` (icon + page names), `Menu.tsx`, `Layout.tsx`, `ThemeSwitch.tsx` (icon button, same names), `theme.ts` (comment only), `Login.tsx`, `DemoLogin.tsx` (looks only), `public/login-kilimanjaro.jpg` (new), `tests/shell.test.tsx` (new tests) | New colors everywhere, Inter only, a menu with icons that collapses and pops up, the top bar with the page name, the login on the photo |
| **R2 Shared pieces** | `theme.css` (Panels, Badges/tables, Buttons, Forms), `StatCard.tsx`, `Panel.tsx` | Cards, tables, buttons, inputs and pills in the new shapes |
| **R3 Pages** | `theme.css` (page sections), `Home.tsx` (dashboard layout) and small markup fixes | Each page made to look like the mock-up, and the Home dashboard |

## 6. Invariants touched
None of the business rules. The owner-only parts are decided in the `.tsx`, not in CSS. Each unit checks in the browser that a shopkeeper still sees no owner-only parts.

## 7. Tests (R1, in `tests/shell.test.tsx`)
- All existing front-end tests still pass.
- `collapse hides the labels visually but every link keeps its name`
- `the collapse button reports aria-expanded and the choice is remembered`
- `the phone menu opens, closes with the button, and closes after choosing a page`
- `the top bar shows the current page's name`

## 8. Done checklist (R1)
- [x] Vanilla and Black-and-white match the mock-up; text contrast checked (all text 5:1 or better, input borders 3:1).
- [x] The menu collapses (laptop) and pops up (phone width); nothing scrolls sideways.
- [x] Login on the photo, centred, readable; the demo box still appears only under `npm run dev`.
- [x] Every test passes, and each new test fails when its feature is broken on purpose; `npm run build` green; backend `pytest` still 117.
- [x] Owner-only parts still missing for a shopkeeper (browser check on a throwaway API). Your depot.db is not touched.
- [x] No file outside the R1 row changed. docs/progress.md updated.

## 9. Open questions (answered: all 4 recommendations accepted)
1. Draw first? Yes, R0 mock-up first.
2. shadcn library or our own CSS? Our plain CSS, plus `lucide-react` for icons, at a pinned version.
3. Collapsible sidebar, remembered? Yes, and a drawer on phones.
4. Fonts? Inter only.

## 10. Changes still needed later (marked by Iddy, 2026-11-06)
- **Warning icons (own unit):** `StatusBadge.tsx` shows a solid amber ⚠️ triangle for LOW, a solid red ⛔ stop sign for OUT with a slow glowing pulse, and a tick for OK, instead of the words. Each icon keeps a hidden name read by screen readers ("Running low", "Out of stock", "In stock"). The pulse stops for people who turn off motion (`prefers-reduced-motion`). Four tests that look for the words change to the new names: `home.test.tsx` (OUT, LOW), `sale.test.tsx` (OK), `stock.test.tsx` (the row cells). The Store balance count buttons keep their names ("OUT: 1"). Pages: Home, New sale, Store balance.
- **Photo rights:** confirm the Kilimanjaro photo may be used in the depot's app, or replace it with a free-licence photo (for example from Unsplash).
- **R2 and R3** as in section 5.
- Not copied from the reference: the notch at the top of the main panel. It can be added in R3 if Iddy wants it.

## 11. Correction after Iddy's PDF review (2026-11-06)
Iddy compared the app with the mock-up (exported as a PDF) and it did not match: R1 had built a top bar with the page name (an idea from the first shadcn draft), kept the old page shapes, and changed the login text. Iddy chose **Home's frame for every page**. The PDF is now the reference, and this replaces anything above that disagrees with it.

| Part | As in the PDF |
|---|---|
| **Frame** | No top bar. Every page starts with one row: the round menu button, the page title (with a short line under it), round action buttons (Home: Refresh), the round theme button, and the user (initials, name, "Owner · API connected"). |
| **Page title** | The old capital "eyebrow" line (HOME, STORE BALANCE…) is gone. The title is smaller (about 30px) with a muted line under it. The browser tab still names the page. |
| **Menu** | Logo with "Distribution depot" under it. Two groups: **Work** (Home, Receive stock, Store balance, Sales records, Restock history) and **Owner** (Items and prices, Users; the group does not exist for a shopkeeper). "Log out" at the bottom. Collapsed: an icon rail of round buttons. Phone: the pop-up drawer. |
| **Login** | "Forgot your password? Ask the depot owner." top right. "DEPOT MANAGEMENT" + "Every crate counted." Card: "Welcome back" / "Log in with your depot account", the fields, a peach-to-pink gradient Log in pill, a "Development only" line, then two small dashed pills "Demo owner" / "Demo shopkeeper" (dev only, the passwords never shown). The promises strip at the bottom. No theme button on the login. |
| **Home** | Greeting "Habari, <name in the accent color>" with the date line. A pill row: **New sale** (filled), Receive stock, Store balance. Four number cards (Sales today with "Owner only", owner only; Items sold "Units"; Low or out; Last restock). Latest sales as a list (time tile, items, "#id · seller · payment", total). Needs restocking as small tiles. |
| **Store balance** | Title "What is in the store" + its line. A card with the search box and an All / OK / Low / Out tab bar with counts, then the table (muted header row, Adjust as a small outlined button). Fixes to stock in a card beside it. |
| **Status** | The PDF draws LOW / OUT / OK as icons. Those stay **words** until the warning-icons unit (W1, section 10), as Iddy decided. |

Tests that change on purpose: the menu order test (groups), the page-title test (it checks the h1 and the browser tab instead of the eyebrow), the log-in heading ("Welcome back"), the top-bar test (removed with the top bar), and the theme test on the log in page (the button moved out of it).

## 12. R2/R3 design agreed in the mock-up (2026-11-06)
An audit of the 8 remaining pages (laptop 1280 px and phone 375 px, throwaway database) found 9 problems that repeat across pages. Iddy approved fixing them once, in shared pieces (R2), then page by page (R3). The mock-up page "R2–R3 · Every page" is now the reference for R2 and R3.

| # | Problem found | Fix (shared piece) |
|---|---|---|
| 1 | Header row breaks on two-column pages; New sale has an extra back link | One header row in the Layout, above the page's columns |
| 2 | Page titles differ from the menu ("Every receipt", "The truck came"…) | Title = the menu name; the friendly sentence goes in the line under it |
| 3 | Tables scroll sideways (Restock, Receive at 681 px on a phone, Store balance cut to 2 rows) | Lists are a table on a laptop and cards on a phone; never an inner sideways scroll |
| 4 | Four looks for "main button"; turned-off buttons look like working ones | 3 levels: filled (one per screen), outlined, underlined; red outline to take away access. Turned off = dashed and flat, with the reason under it. Caramel is never a button |
| 5 | Tiny capital labels; status and facts share one pill | Labels in sentence case above the field; filled badges for state only; outlined "Owner only" tag; "Never edited" is plain muted text |
| 6 | Loading hides the whole frame; empty states have no next step | Loading skeleton inside the frame; empty state = icon, sentence, one action |
| 7 | On a phone the bill and Save sit below every item | A bar fixed at the bottom of the screen holds the total and the main button (New sale, Adjust) |
| 8 | Tap targets under 44 px | Everything tappable is at least 44 px |
| 9 | Wasted laptop space | Main column + side panel (Sales records, Receive, Items, Users) |

Decisions:
- **Fonts:** Plus Jakarta Sans for headings (h1–h3), Inter for text and every number (tabular digits). Both from `@fontsource`, so the app works offline. Tested in the browser: DM Sans was dropped because its digits are not equal width.
- **Patterns borrowed:** shadcn dashboard-01 (number card: label, big number, bold line, muted line; tab bar over a list; footer line under a list); Dribbble POS screens (− / + on each item card, bill on the right, large payment tiles).
- **Photo behind every page, glass blocks (Iddy, 2026-11-06), unit R2c (docs/specs/r02-shared-pieces.md):** the Pinterest idea. First drawn for Home only, then Iddy chose **every page** (not Log in, which already has its own photo). Light mode: the Kilimanjaro photo (same as Log in). Dark mode: a lone tree under a red moon. Changed the same day: the photo fills the **whole page and stays still** while the page scrolls (`position: fixed`), under a soft veil, and **every block is frosted glass** floating on it. List cards use thicker glass (86% light / 72% dark) than number cards so long lists stay readable; text contrast is measured on the real photo before the unit is done. Before building: a larger copy of the tree photo (the one given is 643 × 360 px, blurry on a laptop), and confirm both photos may be used (like r01 section 10).
- **Open:** the pear accent (#CAEA26) from Iddy's Pinterest pin, for dark mode only. It would change the rule "only warnings keep a color". Not decided; the boards are drawn without it.

### Section 11 done checklist
- [x] Frame, menu, login, Home and Store balance follow the PDF in light and dark; no top bar.
- [x] Phone width: the header row fits, the drawer works, the Store balance table fits its card (found in the browser: the table's scroll box shrank to 44px and hid the rows; and the Adjust button stuck out by 42px).
- [x] Every test passes (158); 8 breaks on purpose were each caught; `npm run build` green; no demo password in the build or on the screen.
- [x] Shopkeeper: only the Work group, 3 cards, no day total (browser, throwaway API with sample data). Your depot.db was not touched.
- Files beyond the R1 row, because Home and Store balance were pulled in from R3: `frame.ts` (new), `PageHeader.tsx`, `StatCard.tsx`, `Panel.tsx`, `DemoLogin.tsx`, `format.ts` (`daysAgo`), `Home.tsx`, `Stock.tsx`, and every page (the eyebrow removed); tests in `auth`, `demo`, `home`, `items`, `format`, `shell`.
- Still not in the PDF style: Sale, Receipt, Receive, Adjust, Items, Sales records, Restock, Users (they have the new frame, colors and cards, but not their own touch-ups). That is R2/R3.
