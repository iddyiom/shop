# Unit F2: App shell

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: F1 (setup, theme colors, api.ts).

## 1. Goal
The app gets its frame: the left menu, the top bar with the light/dark switch, and one web address (URL) per screen, each showing an empty page with its title. After F2 the app looks like the "Depot laptop redesign" design around empty content, and every later unit only fills in a page.
User stories covered: none directly (no data yet). It is the frame for all of them.

## 2. Out of scope for this unit
- Real logging in, the token and the real role (F3). Until then the menu uses a fixed example user: the owner.
- Any data on the pages (F4 onwards).
- Sub-pages that belong to a later unit: receipt, adjust stock, edit item (added with their unit).
- A "hamburger" menu button for phones (see question 4).

## 3. Pages and addresses
| Address | Page title | Menu entry | Who |
|---|---|---|---|
| `/login` | Log in | (no menu on this page) | everyone |
| `/` | Home | Home | everyone |
| `/sale` | New sale | none: reached from the big button on Home | everyone |
| `/receive` | Receive stock | Receive stock | everyone |
| `/stock` | Store balance | Store balance | everyone |
| `/items` | Items and prices | Items and prices | owner |
| `/sales` | Sales records | Sales records | everyone |
| `/restock` | Restock history | Restock history | everyone |
| `/users` | Users | Users | owner |
| anything else | Page not found | (menu shown, link back Home) | everyone |

Each page in F2 shows: its eyebrow and title from the design, and one line "Coming in unit F…". Home also shows the big **New sale** button from the design (it links to `/sale`).

## 4. Rules and design decisions
1. **One layout for every page except Log in:** the left menu (logo, links, the user card with name, role and "Log out") and the top bar (API status and the light/dark switch), with the page in the middle. Same look as the design.
2. **The menu depends on the role.** Owner: 7 entries. Shopkeeper: 5 (no Items and prices, no Users). The list lives in one place (`src/menu.ts`). *Hiding is not security* (plan rule 2): the server still refuses owner-only calls.
3. **"New sale" is never in the menu.** It is the big button on Home (decided in the redesign).
4. **The current page is marked** in the menu with the accent color and `aria-current="page"`, so screen readers say it too.
5. **The theme switch** flips `<html data-theme>` between `light` and `dark`. The choice is remembered on that browser in `localStorage` under `depot-theme`. If storage is blocked or broken, the switch still works and the app starts light. *Why localStorage is fine here but not for the token: a theme is not secret.*
6. **The F1 status card becomes a small pill** in the top bar: "API connected" or "API not reachable". It keeps checking `/health` once when the app opens.
7. **Phone width:** the menu stacks above the page (as in the design), links wrap; nothing scrolls sideways.
8. **Keyboard:** a "Skip to content" link is the first thing Tab reaches; every link and button can be reached with Tab and shows a visible focus ring.
9. **Until F3, the user is a fixed example** ("Depot Owner", owner) from one function, `useCurrentUser()` in `src/user.ts`. F3 replaces only that function's inside.

## 5. Implementation
| File | Change |
|---|---|
| `frontend/package.json` | Add `react-router` 8.5.1 (exact) |
| `frontend/src/main.tsx` | Set up the router; apply the saved theme before the first draw |
| `frontend/src/routes.tsx` (new) | The address → page table from section 3 |
| `frontend/src/menu.ts` (new) | Menu entries and which roles see each (rule 2) |
| `frontend/src/user.ts` (new) | `useCurrentUser()`, a fixed owner until F3 (rule 9) |
| `frontend/src/theme.ts` (new) | `readTheme()`, `saveTheme()`, `applyTheme()`, safe when storage fails (rule 5) |
| `frontend/src/components/Layout.tsx` (new) | Menu, user card, top bar, skip link, page slot (rule 1) |
| `frontend/src/components/ThemeSwitch.tsx` (new) | The light/dark button |
| `frontend/src/components/ApiStatus.tsx` (new) | The status pill (rule 6), replacing the F1 card |
| `frontend/src/pages/*.tsx` (new) | `Home`, `Sale`, `Receive`, `Stock`, `Items`, `SalesRecords`, `Restock`, `Users`, `Login`, `NotFound`: empty pages with titles |
| `frontend/src/App.tsx` | Removed (its job moves to `routes.tsx` and `ApiStatus.tsx`) |
| `frontend/src/theme.css` | Layout, menu, top bar, page header, big button, focus ring styles |
| `frontend/tests/*.test.tsx` | F1 tests moved to `ApiStatus` and `api.ts`; new tests below |
| `.claude/launch.json` | Committed with this unit: starts the front end (and the API) from the app's browser pane |

## 6. Front-end rules touched (docs/frontend-plan.md section 3)
- **Rule 2, hiding is not security:** the menu hides owner pages for shopkeepers; F3 and later units still rely on the server's 403.
- **Rule 3, no raw HTML:** all text rendered as text.
- **Rule 5, the token:** not used yet. `localStorage` holds only the theme.

## 7. Tests
- `owner menu shows 7 entries in order`
- `shopkeeper menu has no Items and prices and no Users`
- `menu never shows New sale; Home shows the big New sale button linking to /sale`
- `current page link has aria-current="page"`
- `each address shows its page title` (one check per row of section 3)
- `unknown address shows Page not found with a link Home`
- `log in page has no menu`
- `theme switch flips data-theme and saves the choice`
- `saved theme is used when the app starts`
- `broken storage does not break the theme switch`
- `API pill says "API connected" when /health is ok, "API not reachable" when it fails`
- Kept from F1: the three `apiGet` tests.

## 8. Done checklist
- [ ] Every address in section 3 works, also when typed straight into the browser.
- [ ] Menu matches the design for both roles; "New sale" only on Home.
- [ ] Theme switch works on every page and survives a page reload.
- [ ] At phone width (375 px) the menu stacks and nothing scrolls sideways.
- [ ] Tab reaches "Skip to content" first, then every link and button, with a visible focus ring.
- [ ] `npm test` and `npm run build` green; backend `pytest` still 102.
- [ ] No raw colors outside `theme.css`; no file outside section 5 changed.
- [ ] docs/progress.md updated (F2 Done, decisions, Next = F3, test counts).

## 9. Open questions (answered: all four recommendations accepted)
1. **Where is the theme choice remembered?** On this browser only (`localStorage`), or saved per user on the server so it follows a person to any laptop?
   Recommendation: this browser only. It needs no backend change; the depot has one or two laptops. Per-user saving can come later.
2. **Which role does the menu show before F3?** A fixed owner (with tests for both roles), or a temporary switch on screen to flip between owner and shopkeeper?
   Recommendation: fixed owner plus tests for both. A temporary switch is extra code that F3 would delete again.
3. **The F1 status card:** keep it as a small pill in the top bar, or remove it?
   Recommendation: keep it as a pill. When something does not load, the first question is always "is the API running?", and the pill answers it on every page.
4. **Phone menu:** stack the menu above the page (as the design does), or add a "hamburger" button that opens and closes it?
   Recommendation: stack it for now. The depot uses a laptop; the requirement is only that phones work. A hamburger can be its own small unit if the owner wants it.
