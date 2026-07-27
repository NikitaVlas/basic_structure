# Quality plan

Use this document for each feature or change that affects behavior, data,
permissions, integrations, or a user-facing flow. Create it before
implementation and keep the verification results current.

## Metadata

- Feature/specification:
- Owner:
- Review date:
- Risk level: low / medium / high / critical
- Related specification:
- Related UX review: Not applicable / path

## Scope and acceptance criteria

### In scope

-

### Out of scope

-

### Acceptance criteria

| ID | Criterion | Risk | Verification reference | Status |
|---|---|---|---|---|
| AC-001 |  |  |  | TBD |

Untested acceptance criteria block completion unless explicitly marked
`Not applicable` with a reason and owner.

## Threat model

### Assets and sensitive data

-

### Trust boundaries

-

### Actors and permissions

-

### Threats and mitigations

| Threat / abuse case | Entry point | Impact | Mitigation | Security test | Status |
|---|---|---|---|---|---|
|  |  |  |  |  | TBD |

## Security acceptance criteria

- [ ] Authentication behavior is verified where applicable.
- [ ] Authorization and object-level access are verified for allowed and denied paths.
- [ ] Input validation and output encoding are verified.
- [ ] Injection, XSS, CSRF, unsafe parsing, and error disclosure are assessed as applicable.
- [ ] Secrets, sensitive data, cookies, headers, CORS, and CSP are reviewed as applicable.
- [ ] Rate limits, abuse cases, replay, and resource exhaustion are assessed as applicable.
- [ ] Dependencies and lock files are audited.
- [ ] Security findings have priority, owner, remediation, and status.

## Test coverage matrix

| Requirement / behavior | Unit | Integration | Contract/API | E2E | Visual/a11y | Negative/regression | Test reference | Status |
|---|---|---|---|---|---|---|---|---|
| AC-001 |  |  |  |  |  |  |  | TBD |

### Test scenarios

#### Unit

- Changed logic:
- Validation and error cases:

#### Integration

- Module/data/service boundaries:
- Failure and retry behavior:

#### Contract/API

- Schemas and compatibility:
- Status codes and error responses:
- Permissions:

#### E2E

- Critical user journeys:
- Roles and denied paths:

#### Visual and accessibility

- Responsive states:
- Keyboard/focus/semantics:
- Screenshot or visual regression scope:

#### Regression and negative

- Reproduced bug:
- Invalid input:
- Unauthorized or forbidden access:
- Timeout, retry, partial failure:

## Required commands

| Check | Command | Required | Result | Notes |
|---|---|---|---|---|
| Unit tests | TBD | yes |  |  |
| Integration tests | TBD / Not applicable | yes when applicable |  |  |
| Contract/API tests | TBD / Not applicable | yes when applicable |  |  |
| E2E tests | TBD / Not applicable | yes for user-facing flows |  |  |
| Accessibility/visual | TBD / Not applicable | yes for applicable UI |  |  |
| Security/dependency scan | TBD | yes |  |  |
| Build/typecheck/lint | TBD | yes |  |  |
| Full verification | TBD | yes |  |  |

## Findings and residual risk

| Finding | Category | Priority | Evidence / hypothesis | Validation method | Owner | Status |
|---|---|---|---|---|---|---|
|  | security / testing / UX / accessibility | P1 / P2 / P3 |  |  |  | Open |

## Verification summary

- Passed checks:
- Failed checks:
- Skipped or unavailable checks and reasons:
- Coverage gaps:
- Residual risks:
- Approval:

## Document status

- Status: Draft
- Owner:
- Last reviewed: YYYY-MM-DD
- Related code: Feature-specific
