# Unit 9: Alembic migrations

Status: Done (2026-11-05). Spec agreed with all four recommendations in section 9 accepted. Note: the naming convention has no "ck" pattern, because it would rename the CHECK constraints we already named by hand (rule 4 promise kept).
Depends on: units 1 to 8 (the tables are final for Version 1).

## 1. Goal
The database's tables are created and changed by numbered migration scripts kept in Git, instead of `create_all`. After this unit, adding a column later (for example in Version 2) means writing a new migration and running one command, without losing any data. This is the last step before switching to PostgreSQL.
User stories covered: none directly. It protects all of them: "records are never silently lost or altered" (docs/requirements.md section 8).

## 2. Out of scope for this unit
- Switching to PostgreSQL, installing a PostgreSQL driver, or running the tests against PostgreSQL. That is the deployment phase.
- Any change to what the tables contain. The first migration creates exactly the tables that exist today.
- Docker (deployment phase).
- Seed data inside migrations. Example data stays in `python -m app.manage add-example-data`.

## 3. Commands (no API endpoints in this unit)
| Command | What it does |
|---|---|
| `alembic upgrade head` | Brings the database up to the newest migration. Creates all tables on an empty database |
| `alembic downgrade -1` | Undoes the newest migration |
| `alembic current` | Shows which migration the database is at |
| `alembic revision --autogenerate -m "what changed"` | After a change in `app/models.py`: drafts a new migration to review by hand |

## 4. Rules and design decisions
1. **Alembic is the only thing that creates or changes tables** in a real database. `create_all` is removed from `app/main.py` and `app/manage.py`. The server no longer makes tables at start: run `alembic upgrade head` first.
2. **Tests keep `create_all`** on their in-memory database. *Why: fast, and each test still gets fresh tables. A separate test (rule 7) proves the migrations build the same tables.*
3. **The database address comes from `app/config.py`** (`DEPOT_DATABASE_URL`), not from `alembic.ini`. *Why: one setting for the app and the migrations; no password ever written in a file in Git.*
4. **Every constraint has a stable name.** A naming convention is set on `Base.metadata` (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`), so foreign keys and unique constraints get the same names on SQLite and PostgreSQL. *Why: a later migration can only drop or change a constraint it can name.* Constraints we already named keep their names.
5. **SQLite batch mode is on** (`render_as_batch=True`). *Why: SQLite cannot change a column in place; batch mode copies the table safely. PostgreSQL ignores it.*
6. **The first migration ("initial tables")** is drafted with `--autogenerate`, then read by hand: every table, column, foreign key, unique and CHECK constraint from `app/models.py` must be in it (autogenerate can miss things, so we check). It has a working `downgrade` that drops everything in reverse order.
7. **A test proves migrations and models agree:** run `alembic upgrade head` on a temporary SQLite file, then compare it with `app/models.py`. Any difference fails the test. *Why: if someone changes a model and forgets the migration, the tests catch it.*
8. **From now on, a model change always comes with a migration in the same commit.** Added to docs/code-standards.md and docs/ai-workflow.md (definition of done).
9. **The existing practice `depot.db`** is deleted and rebuilt with `alembic upgrade head` (then `create-owner` and `add-example-data`). *Why: it only holds practice data, and starting clean proves the migration builds a working database from nothing.*
10. **Alembic is pinned** in `requirements.txt` (`alembic==1.20.1`, the newest version when this spec was written), like every other library.

## 5. Implementation
| File | Change |
|---|---|
| `requirements.txt` | Add `alembic==1.20.1` |
| `alembic.ini` (new) | Standard file from `alembic init`, with the database URL line left empty (rule 3) |
| `migrations/env.py` (new) | Reads `DATABASE_URL` from `app.config`, imports `app.models` so every table is known, `target_metadata = Base.metadata`, `render_as_batch=True` |
| `migrations/script.py.mako` (new) | Standard template from `alembic init` |
| `migrations/versions/<id>_initial_tables.py` (new) | The first migration (rule 6) |
| `app/database.py` | Naming convention on `Base.metadata` (rule 4) |
| `app/main.py` | Remove `create_all` and the startup function that ran it |
| `app/manage.py` | Remove `create_all`; if the tables do not exist, print "Run: alembic upgrade head" and stop |
| `tests/test_migrations.py` (new) | Tests below |
| `docs/code-standards.md` | Section 5: "a model change comes with a migration" |
| `docs/ai-workflow.md` | Definition of done: migration included when models change |
| `docs/architecture.md` | Stack table, section 6 "Running things", remove the "no migrations" known gap |
| `CLAUDE.md` | Run line: `alembic upgrade head` before the first start |

## 6. Invariants touched (docs/architecture.md section 4)
- **#1 stock never below 0:** the CHECK constraint must exist in the migrated database, not only in the models. Tested directly (rule 7 and the CHECK test below).
- **#11 runs on SQLite and PostgreSQL:** named constraints and batch mode are what make one set of migrations work on both.

## 7. Tests
`tests/test_migrations.py` (each uses a temporary SQLite file, never `depot.db`)
- `test_upgrade_creates_all_tables` (all 9 tables plus Alembic's own version table)
- `test_migrated_database_matches_models` (Alembic's compare finds no differences)
- `test_migrated_database_enforces_check_constraints` (negative stock refused in the migrated database)
- `test_downgrade_removes_tables_and_upgrade_works_again`
- `test_app_works_on_a_migrated_database` (create a user and log in against a migrated file database)
Plus: all 97 existing tests stay green.

## 8. Done checklist
- [ ] `alembic upgrade head` builds a working database from nothing; `alembic downgrade base` removes it.
- [ ] `create_all` appears only in `tests/conftest.py`.
- [ ] Every test in section 7 exists and passes; full `pytest` green (97 old + new).
- [ ] The first migration contains every table, column, foreign key, unique and CHECK constraint from `app/models.py` (read by hand).
- [ ] No database URL or password in `alembic.ini` or any file in Git.
- [ ] `depot.db` rebuilt from the migration; the server starts and `/docs` works.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (unit Done, decisions, Next, test count).

## 9. Open questions (answered: all four recommendations accepted)
1. **New library.** Add Alembic (`alembic==1.20.1`) to the project? (docs/ai-workflow.md says no new library without asking.)
   Recommendation: yes. It is the standard migration tool for SQLAlchemy, made by the same author, and CLAUDE.md already plans it before PostgreSQL.
2. **The practice database.** Delete `depot.db` and rebuild it from the migration (rule 9), or keep it and mark it as already migrated (`alembic stamp head`)?
   Recommendation: delete and rebuild. It holds only practice data, and rebuilding proves the migration works. Keeping it would hide any small difference between the old tables and the migration.
3. **Server start.** Should the server run migrations automatically when it starts, or must you run `alembic upgrade head` yourself?
   Recommendation: you run it yourself. Changing a real database's tables should be a deliberate step you see happen, not a side effect of starting the server.
4. **Folder name.** `migrations/` (clear) or Alembic's default `alembic/`?
   Recommendation: `migrations/`. It says what is inside, and it cannot be confused with the installed `alembic` library.
