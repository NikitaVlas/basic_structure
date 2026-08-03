# Feature: Email verification, password recovery, and account security

## Status

- Lifecycle: Approved for implementation
- Owner: Project maintainers
- Date: 2026-08-03

## Requirements

- When a user registers, the system shall create a single-use email
  verification token and dispatch a verification message without exposing the
  raw token to persistence or logs.
- When any visitor requests password recovery, the system shall return the same
  accepted response whether or not the account exists.
- When a valid password-reset token is consumed, the system shall replace the
  password hash, consume the token atomically, and revoke every active session.
- While a user is authenticated, when they request their sessions, the system
  shall return only their own allowlisted session metadata.
- While a user is authenticated, when they revoke a session, the system shall
  enforce ownership in the database mutation and prevent IDOR.
- When a security-sensitive action occurs, the system shall persist an audit
  event without credentials, raw tokens, email addresses, or raw IP addresses.
- When an email provider is unavailable, registration shall remain consistent,
  the dispatch failure shall be logged safely, and the verification message
  shall be retryable.

## Architecture

### Frontend

- Verification confirmation, forgot-password, reset-password, and account
  security views use shared Zod schemas and server-authoritative errors.
- Session rows expose created/last-seen/expiry timestamps and a current-session
  marker; they never expose cookie/token values.
- Destructive session actions require an explicit user action, loading state,
  error announcement, and refresh after success.

### Backend

- `packages/email` defines transport-neutral messages, a safe console transport
  for local development, and a provider adapter selected by validated env.
- `action_tokens` stores purpose, digest, expiry, consumption, and user owner.
- Session metadata and audit events live in PostgreSQL and are accessed only
  through parameterized repositories.
- Auth service coordinates transactions: token consumption and password/session
  mutations must not leave partially applied security state.

### Security checkpoint

| Area | Decision |
|---|---|
| Token generation | 32 random bytes, base64url; SHA-256 digest persisted |
| Token lifetime | Verification: 24h; reset: 30m; one unconsumed token per purpose/user |
| Enumeration | Forgot response is always `202`; provider work is skipped silently for unknown email |
| Reset atomicity | Row lock token, update password, revoke sessions, consume token in one transaction |
| Session authorization | `DELETE ... WHERE id=$1 AND user_id=$2`; zero affected rows becomes 404 |
| CSRF | Existing same-origin mutation enforcement applies to authenticated session actions |
| Rate limiting | Forgot, resend, confirm, and reset use bounded source limits |
| Audit privacy | Event type, request ID, actor ID, and keyed IP digest only; no PII/token fields |
| Output | Explicit verification/session DTOs; no password hash, token digest, raw user agent, or IP |
| Email links | Public base URL comes from validated configuration; token is placed only in the link |
| Provider failure | Safe error event; no API key, recipient, or message body in logs |

## Data changes

- `users.email_verified_at TIMESTAMPTZ NULL`.
- `sessions.last_seen_at TIMESTAMPTZ`, `user_agent_summary TEXT NULL`,
  `ip_digest TEXT NULL`.
- `action_tokens(id, user_id, purpose, token_digest, expires_at, consumed_at,
  created_at)`.
- `security_audit_events(id, user_id, event_type, request_id, ip_digest,
  created_at)`.

## API

| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/v1/auth/verification/request` | Session | Dispatch/re-dispatch verification |
| POST | `/api/v1/auth/verification/confirm` | Public token | Consume token and mark verified |
| POST | `/api/v1/auth/password/forgot` | Public | Always `202` |
| POST | `/api/v1/auth/password/reset` | Public token | Reset password and revoke sessions |
| GET | `/api/v1/auth/sessions` | Session | List owned sessions |
| DELETE | `/api/v1/auth/sessions/:id` | Session + origin | Revoke owned session |
| POST | `/api/v1/auth/sessions/revoke-others` | Session + origin | Keep only current session |

## Email boundary

- `EMAIL_TRANSPORT=console` is the local default and must redact the token from
  logs; development inspection uses Mailpit when the SMTP adapter is selected.
- Provider adapters receive `to`, template identifier, subject, and text/html
  bodies. Provider credentials come only from environment variables.
- Sending is synchronous in this iteration; a durable outbox/background worker
  remains the production-hardening follow-up.

## Acceptance criteria

- AC-001: raw verification/reset tokens never appear in database rows or logs.
- AC-002: expired and consumed tokens are rejected.
- AC-003: forgot responses are indistinguishable for known/unknown email.
- AC-004: reset revokes all sessions and the old password no longer works.
- AC-005: a user cannot revoke another user's session.
- AC-006: audit events contain no email/token/password/raw IP fields.
- AC-007: local Mailpit receives messages through the SMTP adapter.
- AC-008: generated audit, typecheck, unit, integration, and builds pass.

## Implementation plan

- [ ] Add transactional email module and transport adapters.
- [ ] Add migration and repositories.
- [ ] Add shared contracts.
- [ ] Implement verification and recovery services/routes.
- [ ] Implement session management and audit persistence.
- [ ] Add browser account/recovery UI.
- [ ] Add Mailpit and integration validation.
- [ ] Document operations and residual risks.

## Deferred

- Durable outbox, provider webhooks, bounce/complaint processing, MFA, account
  deletion, device fingerprinting, and administrator audit search.
