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
3. Run a scoped `find-skills` review. Always assess frontend security,
   backend/API security, and testing capabilities; assess UX only when an
   interface or user-facing flow exists.
4. Validate candidate skills for source, pinning, platform compatibility,
   scripts, dependencies, and a minimal smoke test before approval.
5. Create a feature specification from the answers and evidence.
6. Resolve open questions and obtain approval.
7. Define UX decisions when applicable, security acceptance criteria, and a
   test matrix before implementation.
8. Copy `docs/development/quality-plan-template.md` to
   `docs/development/quality-plans/SPEC-XXXX-quality.md` and approve it for the
   feature.
9. Add an implementation plan to the approved specification.
10. Implement only the approved scope.
11. Update the feature-specific quality plan with test references and findings
    during work.
12. Add tests for all changed behavior and affected boundaries.
13. Run security review and the required verification matrix.
14. Run UX/accessibility audit when UI is in scope.
15. Review the diff and acceptance criteria.
16. Record coverage, verification results, findings, and known limitations in
    the specification and feature-specific quality plan.
17. Update only documentation made stale by the change.

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

