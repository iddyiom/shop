# AI Workflow Rules

How the coding agent (Claude) behaves while building this project.
The other docs say WHAT we build and HOW the code looks. This file says how the work is done.

## 1. Start of every session
1. Read CLAUDE.md, then docs/progress.md.
2. Say in one or two lines where the project stands and what "Next" is.
3. Read only the other docs the current unit needs (requirements, database design, API plan, code standards, its spec).

## 2. One unit at a time
- Work on exactly one unit from docs/progress.md.
- Never mix two areas in one step (for example, items and deliveries together).
- A unit must be small enough to finish, test and commit in one session.
- If a unit turns out too big, stop and propose splitting it (5a, 5b) before going on.

## 3. Spec before code
- No code for a unit until its spec exists in `docs/specs/` and Iddy has agreed to it.
- When coding starts: set the unit to "In progress" in docs/progress.md.
- Build exactly what the spec says. Nothing extra.

## 4. Stay in scope
- Do not touch files the spec does not mention, except to register a router in `app/main.py` or add fixtures in `tests/conftest.py`.
- Do not "improve" unrelated code while passing by. Write it down under "Noticed" in the report instead.
- Anything in "Parked" (CLAUDE.md) or "Out of scope" (requirements section 11) is never built, even partly.
- No new libraries, services or tools without asking first (see the decision about Clerk, Liveblocks and Trigger.dev in docs/progress.md).

## 5. Stop and ask when
- The spec and the docs disagree, or the spec is silent on something that matters.
- A choice would be hard to undo: a table change, a new dependency, a change to a rule in CLAUDE.md.
- A "never break" rule seems to block the spec. The rule wins until Iddy decides otherwise.
Ask one clear question, give a recommendation, and wait. Do not guess.

## 6. Definition of done (every unit)
- [ ] Every item in the spec's checklist is true.
- [ ] Tests added for the new rules, including the forbidden path (shopkeeper gets 403).
- [ ] `pytest` is fully green.
- [ ] Code follows docs/code-standards.md.
- [ ] If `app/models.py` changed: a reviewed migration is in `migrations/versions/` and `alembic upgrade head` works.
- [ ] docs/progress.md updated: unit Done with its commit, new decisions added, "Next" set, test count updated.
- [ ] Committed (only when Iddy says so).

## 7. When something is wrong
- Do not rewrite the whole unit. Fix the one thing that is wrong.
- A good fix request says: what is wrong, what was expected, where.
  Example: "GET /products shows `buying_price` to a shopkeeper. Expected: field missing for shopkeepers. Where: ProductOut in app/schemas.py."
- If a fix changes a decision, add it to "Decisions made" in docs/progress.md.

## 8. Teaching (this is a learning project)
- Follow the teaching steps in CLAUDE.md: concept, then code in small steps, then a challenge, then review.
- Explain every new idea the first time it appears, in simple words.
- Iddy must be able to explain the code. If something is too clever to explain simply, write it more simply.

## 9. End of every unit (report)
A short report with:
- what was built (endpoints, files),
- test result (number passing),
- decisions made,
- "Noticed": anything outside scope worth doing later,
- the challenge for Iddy.
