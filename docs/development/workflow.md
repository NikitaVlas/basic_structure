# Development workflow

## Sources of truth

| Information | Source |
|---|---|
| Product goals and boundaries | `docs/project/` |
| Architecture | `docs/architecture/` |
| Feature behavior | Approved feature specification |
| Visual state | Approved Figma frame, when enabled |
| Verification | `docs/development/verification.md` |
| Implementation state | Code and tests |

## Project initialization

Questionnaires → repository research → project documentation → architecture →
permissions → capabilities → reviewed tooling → verification → readiness review.

## Feature delivery

1. Complete `docs/questionnaires/feature-init.md`.
2. Research current behavior and affected code.
3. Create a feature specification from the answers and evidence.
4. Resolve open questions and obtain approval.
5. Add an implementation plan to the approved specification.
6. Implement only the approved scope.
7. Add tests selected from the testing and verification matrices.
8. Run required verification.
9. Review the diff and acceptance criteria.
10. Record verification results and known limitations.
11. Update only documentation made stale by the change.

Specification lifecycle:

`Draft → Ready for Review → Approved → In Progress → Implemented → Verified → Completed`

If implementation reveals a requirements problem, return the specification to
`Draft` or `Ready for Review`; do not silently alter approved behavior.

## Bug fix

Reproduction → root cause → regression test → minimal fix → relevant checks →
side-effect review → report.

## Architectural change

Research → options → trade-offs → ADR → approval → migration plan →
implementation → extended verification.

## Human approval points

Use `agent/permissions.md`. Stop conditions in `AGENTS.md` apply even when a
technical implementation is possible.

## Documentation freshness review

After substantial work, check architecture, commands, behavior, constraints,
ADRs, specifications, and optional design artifacts. Update a document only when
its described reality changed.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: YYYY-MM-DD
- Related code: Repository-wide

