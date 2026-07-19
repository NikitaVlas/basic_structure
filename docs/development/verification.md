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

