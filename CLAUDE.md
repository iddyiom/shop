# Depot Management System (Project 1)

## Who I am working with
Iddy, a Computer Engineering student at DIT, Tanzania. Beginner coder. Goals: backend/APIs, AI/data, cybersecurity. Claude writes the code; Iddy must understand it.

## How to teach (always)
1. Concept first, in simple words, with a small picture or example.
2. Then the code, in small steps, explaining each part.
3. Then a short challenge for Iddy to try.
4. Then review Iddy's attempt.
Keep replies concise. Do not dump big files without explaining them. Ask before big decisions.

## The project
A real depot management system for a depot owner who distributes one company's products. Roles: owner (includes everything a shopkeeper can do) and shopkeeper.
Read these first, they are the source of truth:
- docs/requirements.md
- docs/database-design.md
- docs/api-plan.md
- docs/progress.md (where we are: read at the start of every session, update at the end of every unit)
- docs/architecture.md (stack and why, the layers, how a request flows, invariants with where each is enforced and tested)
- docs/code-standards.md (how code is written: where it goes, routers, services, errors, tests)
- docs/ai-workflow.md (how the agent works: one unit at a time, spec first, stay in scope, when to ask, definition of done)
- docs/frontend-plan.md (Phase 4: React front end decisions, rules and units)
Wireframes (Phase 2) are published as a design artifact: https://claude.ai/artifact/LmiixK7Lj3BtMVbTrsCgcK (private to Iddy).
Laptop redesign (Phase 4 screens, light = Sage, dark = Deep Blue): https://claude.ai/artifact/WkSjbsigXCS5q2WFJhr7tk (private to Iddy).

## Tech track
- Python, FastAPI, SQLAlchemy.
- Database: SQLite for now. Switch to PostgreSQL before deployment (code must not depend on SQLite only).
- Git/GitHub from the first commit.
- No Docker yet (added in the deployment phase).
- React front end (Phase 4): TypeScript, Vite, plain CSS theme variables, in `frontend/`. See docs/frontend-plan.md.
- Tests with pytest.

## Rules that must never break
- The server recalculates all prices and totals, and re-checks stock. Never trust the screen.
- Stock never below 0. A sale or delivery is one all-or-nothing transaction.
- Never hard-delete. History (sales, deliveries, price_history, stock_entries) is never edited.
- Owner-only: prices, items and sub-items, buying prices, money totals, corrections, adjustments, unlocking users.
- Passwords are stored hashed.

## Current phase
Phase 4: React front end (Phase 3, the API, is complete). Units, status and decisions are in docs/progress.md (the single place for this, so it never goes out of date here). Tables are made and changed only by Alembic migrations (`migrations/`); a model change always comes with a migration.

## How we build (spec-driven)
One unit at a time. Before coding a unit, write its spec in docs/specs/ (copy docs/specs/_template.md) with a "done" checklist. Build only what the spec says. When the checklist passes: tests green, commit, update docs/progress.md.

Run: `.venv\Scripts\activate`, then `alembic upgrade head` (makes or updates the tables), then `uvicorn app.main:app --reload`. Tests: `pytest`. First owner: `python -m app.manage create-owner`.
Front end (second terminal): `cd frontend`, `npm install` (first time), `npm run dev`, open http://localhost:5173. Front-end tests: `npm test`; type check and build: `npm run build`.

## Parked (do not build now)
TRA/VAT, van tracking, profit reports, debts (Version 2), expenditure, printing.
