# Redesign R2: shared pieces (split into R2a and R2b)

Status: Agreed 2026-11-06 (all 3 recommendations accepted). R2a Done (cf62b01). R2b next.
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

**R2b** (written in detail after R2a is committed)
| File | Change |
|---|---|
| `components/PageHeader.tsx`, `menu.ts` | h1 = page name; `subtitle` holds the sentence |
| `components/Panel.tsx`, new `components/EmptyState.tsx`, new `components/Skeleton.tsx` | designed loading and empty states |
| each page `.tsx` | pass the new header props; `data-label` on table cells; empty states |
| `theme.css` | table-to-cards on a phone, skeleton, empty state |
| tests | the title tests (`shell`, `home`, `items`, …) look for the menu name |

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
