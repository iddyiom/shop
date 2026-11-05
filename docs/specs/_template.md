# Unit N: <name>

Status: Draft | Agreed | Done
Depends on: <units that must be done first>

## 1. Goal
One or two sentences: what the depot can do after this unit that it could not do before.
User stories covered (docs/requirements.md section 5): #...

## 2. Out of scope for this unit
What this unit deliberately does NOT do, even though it is close by.

## 3. Endpoints
| Method | Path | Who | Success | Errors |
|---|---|---|---|---|

Request and response examples for anything not obvious.

## 4. Rules and design decisions
The business rules this unit enforces, and every choice the docs did not already make.
Each decision: what we chose, and why in one line.

## 5. Implementation
Files to create or change, and what goes in each. Follow docs/code-standards.md.
| File | Change |
|---|---|

## 6. Invariants touched
Which invariants in docs/architecture.md section 4 this unit touches, and how it keeps them.

## 7. Tests
One line per test, named the way the test function will be named.

## 8. Done checklist
- [ ] Every endpoint in section 3 works as described.
- [ ] Every test in section 7 exists and passes; full `pytest` green.
- [ ] Shopkeeper gets 403 on every owner-only endpoint.
- [ ] No file outside section 5 changed.
- [ ] docs/progress.md updated (unit Done, decisions, Next, test count).

## 9. Open questions (answer before coding)
Questions for Iddy, each with a recommendation.
