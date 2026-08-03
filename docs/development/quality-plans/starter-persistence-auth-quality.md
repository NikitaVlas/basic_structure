# Quality plan: persistence and authentication starter modules

## Scope and acceptance criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-001 | Generated SQL access is parameterized | Repository tests and source review |
| AC-002 | Passwords and raw session tokens are never persisted or returned | Unit/integration tests |
| AC-003 | Shared schemas reject malformed and unknown input | Contract tests |
| AC-004 | Login does not disclose account existence | Negative API tests |
| AC-005 | Cookie mutations enforce same-origin metadata | Negative API tests |
| AC-006 | Generated project installs with zero known vulnerabilities | `npm audit` |
| AC-007 | Database migrations apply to a clean PostgreSQL instance | Docker integration test |
| AC-008 | Typecheck, tests, and production builds pass | Generated `npm run verify` components |

## Threat model

| Threat | Mitigation | Required evidence |
|---|---|---|
| SQL injection | Static SQL plus `$n` parameters | Repository tests/source review |
| Credential stuffing | Generic errors and bounded rate limiter | Negative tests |
| Password database compromise | Salted scrypt hashes | Hash/verify tests |
| Session database compromise | Persist only token digest | Integration test |
| Session theft through XSS | HttpOnly cookie; no browser token storage | UI/API review |
| CSRF | SameSite cookie and origin enforcement | Negative route test |
| IDOR | Identity derived from session, explicit DTO | `/me` tests |
| Secret leakage | Environment validation and redacted logs | Config/log tests |
| Dependency compromise | Pinned lockfile after generation and audit gate | Audit result |

## Required commands

| Check | Command |
|---|---|
| Starter tests | `node --test` |
| Starter verification | `node scripts/verify.mjs --mode template` |
| Generated audit | `npm audit` |
| Generated typecheck | `npm run typecheck` |
| Generated unit tests | `npm run test` |
| Generated integration | `npm run test:integration` |
| Generated build | `npm run build` |

## Completion policy

No acceptance criterion may be marked complete without command output or a
specific test reference. Docker-dependent checks must be reported separately
when Docker is unavailable.

## Verification results

- Starter tests: 11 passed.
- Starter documentation/extension verification: 33 documents and 7 extensions passed.
- Generated dependency audit: 0 known vulnerabilities.
- Generated monorepo typecheck: API, webapp, website, auth, contracts, database,
  and observability passed.
- Unit/contract/security tests: passed; database-dependent cases were then run
  separately rather than counted as skipped evidence.
- PostgreSQL integration: migration idempotency and full auth lifecycle passed
  against PostgreSQL 18.4.
- Production builds: API TypeScript, React/Vite, and Astro passed.
- Residual boundary: the in-memory rate limiter must be replaced before
  horizontal API scaling.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/persistence-auth-design.md`
