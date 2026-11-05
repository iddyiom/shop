# Unit F1: Front-end setup

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted.
Depends on: Phase 3 API (only `GET /health`), docs/frontend-plan.md.

## 1. Goal
A working React + TypeScript project in `frontend/`. Running `npm run dev` opens one page, in the depot's light theme, that asks the API "are you there?" through the Vite forwarder and shows the answer. The first front-end test passes. Every later unit (F2 to F10) builds on this.
User stories covered: none yet. This is the foundation.

## 2. Out of scope for this unit
- The menu, top bar, light/dark switch and pages (F2).
- Logging in, the token, `/auth/...` (F3).
- React Router: installed in F2, when there is more than one page.
- Production build hosting and CORS (deployment phase).

## 3. What you will see
`npm run dev` → http://localhost:5173 shows a centered card:
- API running: "Depot" logo mark, the heading **"The API is running"**, and the text "Front end and API are talking. Next: the menu and pages (F2)."
- API stopped: the heading **"Cannot reach the API"**, and the text "Start it in another terminal: uvicorn app.main:app --reload".
- While waiting: "Checking the API…".

It uses the light (Sage) colors and the Montserrat and Inter fonts from the design.

## 4. Rules and design decisions
1. **Vite forwards `/api`** to `http://127.0.0.1:8000` and removes the `/api` part: the page asks `/api/health`, FastAPI receives `/health`. No CORS, and no change to the backend.
2. **`src/api.ts` is the only file that calls `fetch`** (plan rule). In F1 it has one small function, `apiGet(path)`: it adds `/api`, reads the JSON, and throws an `ApiError` holding the API's `error` and `message` when the answer is not OK. F3 adds the login token to it.
3. **All colors are CSS variables** in `src/theme.css`, copied from the design's THEMES lists: one block for `[data-theme="light"]` (Sage) and one for `[data-theme="dark"]` (Deep Blue). Components only use `var(--page)`, `var(--accent)`, etc., never a raw color. F1 sets `data-theme="light"` on the page; F2 adds the switch.
4. **TypeScript strict mode** on, same spirit as the backend: no `any`.
5. **Exact versions:** `frontend/.npmrc` has `save-exact=true`, so `package.json` lists `"react": "19.3.1"`, not `"^19.3.1"`. `package-lock.json` is committed. (Like `requirements.txt` with `==`.)
6. **Hand-written setup, no template.** Each file is small and explained; no demo logos or counters to delete.
7. **Fonts are bundled** with the app (`@fontsource/montserrat`, `@fontsource/inter`), not loaded from Google. *Why: the depot's internet can drop; the app should still look right on the local network.*

## 5. Implementation
| File | Change |
|---|---|
| `frontend/package.json` (new) | Scripts: `dev`, `build` (type check, then build), `test`, `typecheck`. Libraries below |
| `frontend/.npmrc` (new) | `save-exact=true` |
| `frontend/tsconfig.json` (new) | Strict TypeScript for `src/` and `tests/` |
| `frontend/vite.config.ts` (new) | React plugin, `/api` forwarder (rule 1), Vitest settings (jsdom) |
| `frontend/index.html` (new) | The one HTML page, `<html data-theme="light">`, `<div id="root">` |
| `frontend/src/main.tsx` (new) | Loads fonts and `theme.css`, starts React |
| `frontend/src/theme.css` (new) | Color variables for light and dark (rule 3), base page styles |
| `frontend/src/api.ts` (new) | `ApiError` and `apiGet` (rule 2) |
| `frontend/src/App.tsx` (new) | The API status card (section 3) |
| `frontend/tests/App.test.tsx` (new) | Tests below |
| `.gitignore` | Add `frontend/node_modules/` and `frontend/dist/` |
| `CLAUDE.md` | Run line: how to start the front end and run its tests |
| `docs/code-standards.md` | New short section "Front end": where files go, CSS variables only, `api.ts` only, no `dangerouslySetInnerHTML` |

Libraries (latest stable today, pinned exactly):
- App: `react` 19.3.1, `react-dom` 19.3.1, `@fontsource/montserrat` 5.3.0, `@fontsource/inter` 5.3.0
- Tools (development only): `typescript` 7.0.2, `vite` 8.3.6, `@vitejs/plugin-react` 6.2.1, `vitest` 5.1.0, `@testing-library/react` 16.3.3, `jsdom` 31.0.0, `@types/react` 19.3.0, `@types/react-dom` 19.3.0

(`@vitejs/plugin-react` and the two `@types` packages are small helpers the plan did not list: the plugin lets Vite understand React files, the types let TypeScript understand React.)

## 6. Front-end rules touched (docs/frontend-plan.md section 3)
- **Rule 3, no raw HTML:** the card renders text only.
- **Rule 5, the token:** not used yet; `api.ts` is shaped so F3 adds it in one place.

## 7. Tests
`frontend/tests/App.test.tsx` (fetch is replaced by a fake, so tests never need the API running)
- `shows "The API is running" when /api/health answers ok`
- `shows "Cannot reach the API" when the request fails`
- `shows "Checking the API…" before the answer arrives`
`apiGet` (same file or `tests/api.test.ts`)
- `apiGet adds /api to the path`
- `apiGet throws ApiError with the API's message on a 4xx answer`

## 8. Done checklist
- [ ] `npm install` then `npm run dev` shows the card; with the API running it says "The API is running", with it stopped "Cannot reach the API".
- [ ] `npm test` passes; `npm run build` passes (no TypeScript errors).
- [ ] No raw colors outside `theme.css`.
- [ ] `node_modules/` and `dist/` are not in Git; `package-lock.json` is.
- [ ] Backend untouched: `pytest` still 102 passing.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (F1 Done, decisions, Next = F2, test counts for both sides).

## 9. Open questions (answered: all four recommendations accepted)
1. **Setup by hand or from the Vite template?** (`npm create vite` makes a starter with demo logos and a counter.)
   Recommendation: by hand (rule 6). About 9 small files, each one explained, nothing to delete.
2. **Exact versions?** `save-exact=true` (rule 5), or npm's default `^` ranges?
   Recommendation: exact. You always know which version runs, the same as `==` in `requirements.txt`.
3. **Fonts: bundled or from Google Fonts?** Bundling adds two small libraries.
   Recommendation: bundled (rule 7). The app keeps its look when the internet is down.
4. **Default theme: always light, or follow the computer's setting?** (Windows can be set to dark mode.)
   Recommendation: always light in F1. F2 adds the switch and remembers each person's choice on that browser.
