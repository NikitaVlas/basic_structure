# Verification

Replace every applicable placeholder with a real, repository-tested command.
Use `Not applicable — <reason>` where a check does not apply.

## Commands

| Check | Command | Required in CI |
|---|---|---|
| Setup | TBD | No |
| Development | TBD | No |
| Format check | TBD | Yes |
| Lint | TBD | Yes |
| Typecheck | TBD | Yes |
| Unit tests | TBD | Yes |
| Integration tests | TBD | Project-specific |
| E2E tests | TBD | Project-specific |
| Build | TBD | Yes |
| Security | TBD | Project-specific |
| Full verification | TBD | Yes |

Prefer one `verify` command that runs the standard local and CI checks.

## Mandatory quality gates

Every project must define these gates from initialization. A gate may be
marked `Not applicable` only with a documented reason and owner approval.

### Test coverage

- Unit tests cover changed business logic, validators, transformations, and
  error handling.
- Integration tests cover changed module, database, queue, and service
  boundaries.
- Contract/API tests cover schemas, permissions, status codes, errors, and
  backward compatibility when an API or integration exists.
- E2E tests cover critical user journeys when a user-facing flow exists.
- Regression tests reproduce and prevent every fixed bug.
- Accessibility and visual tests cover applicable UI changes.
- Negative tests cover invalid input, unauthorized access, missing resources,
  timeouts, retries, and partial failures where relevant.
- The feature specification maps each acceptance criterion to one or more test
  scenarios. Untested criteria are a completion blocker.

### Security coverage

Before implementation, record a lightweight threat model and security
acceptance criteria covering, as applicable:

- authentication, authorization, roles, and object-level access;
- input validation, output encoding, XSS, CSRF, injection, and unsafe parsing;
- secrets, sensitive data, logs, cookies, headers, CORS, and CSP;
- rate limits, abuse cases, replay, resource exhaustion, and error disclosure;
- dependency and lock-file audit, migrations, backups, and data retention.

Security review must include positive and negative permission tests and a
dependency/security scan. A green functional test suite alone is not a
security sign-off.

## Required by change type

| Change type | Required checks |
|---|---|
| Documentation only | Format/link checks when available |
| Business logic | Lint, typecheck, unit tests, build |
| Data access | Standard checks plus integration tests |
| Public contract | Standard checks plus contract/integration tests |
| Critical user flow | Standard checks plus E2E |
| Visual UI | Standard checks, UI tests, screenshot and responsive review |
| Security or permissions | Standard checks, integration and negative tests, security review |
| Migration | Standard checks, migration test, rollback/compatibility review |

## CI expectations

- CI uses the same verification entry point as local development where possible.
- Required checks fail on warnings only when the project explicitly configures it.
- Tests do not depend on developer-specific state.
- Generated artifacts and migrations are checked for drift when applicable.
- Security-sensitive output is redacted.

## Reporting

Every completion report lists:

- commands run;
- checks that passed;
- checks that failed, including relevant error summaries;
- checks not run and why;
- manual or visual checks performed;
- residual risks and limitations.

## Document status

- Status: Draft
- Owner:
- Last reviewed:
- Related code: Build, test, and CI configuration

