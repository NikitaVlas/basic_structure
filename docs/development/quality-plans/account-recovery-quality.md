# Quality plan: account recovery and session security

## Coverage matrix

| Criterion | Unit | Integration | Negative/security |
|---|---|---|---|
| Token digest/expiry/single use | Token utility | PostgreSQL consume flow | Replay and expiry |
| Enumeration resistance | Response contract | Known/unknown forgot | Same status/body |
| Password reset | Hash validation | Transaction + session revoke | Old password/session denied |
| Session ownership | Repository query | Two-user session flow | Cross-user revoke denied |
| Audit privacy | Event schema | Stored event inspection | Forbidden fields absent |
| Email transport | Message rendering | Mailpit SMTP delivery | Provider failure redaction |

## Required commands

- `node --test`
- `node scripts/verify.mjs --mode template`
- `npm audit --audit-level=high`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration`
- `npm run build`

## Completion gates

- No raw token, password, cookie, provider credential, recipient address, or raw
  IP may appear in security logs.
- Reset/session ownership tests are blockers, not optional coverage.
- Provider delivery may use Mailpit locally; production delivery requires a
  configured external provider and HTTPS public URLs.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/account-recovery-design.md`
