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
Wireframes (Phase 2) are published as a design artifact: https://claude.ai/artifact/LmiixK7Lj3BtMVbTrsCgcK (private to Iddy).

## Tech track
- Python, FastAPI, SQLAlchemy.
- Database: SQLite for now. Switch to PostgreSQL before deployment (code must not depend on SQLite only).
- Git/GitHub from the first commit.
- No Docker yet (added in the deployment phase).
- React front end later.
- Tests with pytest.

## Rules that must never break
- The server recalculates all prices and totals, and re-checks stock. Never trust the screen.
- Stock never below 0. A sale or delivery is one all-or-nothing transaction.
- Never hard-delete. History (sales, deliveries, price_history, stock_entries) is never edited.
- Owner-only: prices, items and sub-items, buying prices, money totals, corrections, adjustments, unlocking users.
- Passwords are stored hashed.

## Current phase
Phase 3: Coding. Step 1: project setup (folder, Git, virtual environment, FastAPI hello world), then database models from docs/database-design.md, then auth, then sales.

## Parked (do not build now)
TRA/VAT, van tracking, profit reports, debts (Version 2), expenditure, printing.
