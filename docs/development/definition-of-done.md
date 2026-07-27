# Definition of Done

Mark non-applicable items explicitly and explain material exceptions.

## Requirements

- [ ] Implementation matches the approved specification.
- [ ] Acceptance criteria are satisfied.
- [ ] Scope was not expanded without approval.
- [ ] Open questions affecting delivery are resolved.

## Code

- [ ] Architecture and dependency rules are respected.
- [ ] No unrelated changes are included.
- [ ] No temporary or debug code remains.
- [ ] New dependencies are justified and approved where required.
- [ ] Public contracts remain compatible or the change was approved.

## Tests

- [ ] The coverage matrix maps every acceptance criterion to a test or an approved `Not applicable` reason.
- [ ] Unit tests cover changed logic, validation, and error handling.
- [ ] Integration tests cover changed module, data, and service boundaries.
- [ ] Contract/API tests cover changed public schemas and error behavior when applicable.
- [ ] E2E tests cover critical user journeys when a user-facing flow exists.
- [ ] Negative tests cover invalid input, unauthorized access, and relevant failure paths.
- [ ] Accessibility and visual tests were run for applicable UI changes.
- [ ] Required tests were added or updated.
- [ ] A regression test covers a fixed reproducible bug when feasible.
- [ ] Test results and meaningful coverage gaps are recorded.
- [ ] Skipped or unavailable checks are listed.

## Security

- [ ] A threat model or security-impact assessment was completed before implementation.
- [ ] Security acceptance criteria are verified.
- [ ] Authentication, authorization, object-level permissions, and negative cases were reviewed.
- [ ] Input validation, output encoding, injection, XSS/CSRF, rate limits, and error disclosure were checked as applicable.
- [ ] Dependencies and lock files received the required security audit.
- [ ] Secrets and sensitive data were not exposed.
- [ ] Security-sensitive changes received the required review.

## Verification gates

- [ ] Lint, typecheck, build, and required project checks passed.
- [ ] Security checks and dependency scan passed or have approved exceptions.
- [ ] Full verification command passed.
- [ ] UX/product audit was completed for UI or user-facing flow changes.
- [ ] Accessibility review was completed for UI changes.
- [ ] Any failed, skipped, or unavailable check has a reason, owner, and follow-up.

## Data

- [ ] Migrations were tested.
- [ ] Destructive changes were approved.
- [ ] Rollback and backward compatibility were considered.

## Design

- [ ] UI matches the approved design artifact, when applicable.
- [ ] Supported responsive states were checked.
- [ ] Loading, empty, error, and disabled states were handled.
- [ ] Keyboard navigation, focus, and accessibility were checked.
- [ ] Known visual deviations are documented.

## Documentation

- [ ] A feature-specific quality plan exists under `docs/development/quality-plans/`.
- [ ] The quality plan contains the threat model, test coverage matrix, findings, and verification summary.
- [ ] Documentation affected by the change was updated.
- [ ] Significant decisions were recorded in an ADR.
- [ ] Outdated information was corrected or marked `Outdated`.
- [ ] The specification contains verification results and known limitations.

## Final review

- [ ] The final diff was reviewed.
- [ ] Verification evidence is reported accurately.
- [ ] Known limitations and residual risks are listed.
- [ ] The result is described clearly to the user.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: YYYY-MM-DD
- Related code: Repository-wide

