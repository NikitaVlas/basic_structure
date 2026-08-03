# Feature: Composable persistence and authentication foundation

## Status

- Lifecycle: Approved for implementation
- Owner: Project maintainers
- Date: 2026-08-03

## Requirements

- While the `fullstack-web` profile is selected, when the PostgreSQL module is
  enabled, the generator shall add a pooled database package, ordered SQL
  migrations, and parameterized repository operations.
- While persistence is enabled, when the auth module is selected, the generator
  shall add registration, login, logout, and current-session endpoints plus an
  accessible browser flow.
- When any API payload is received, the server shall validate it with the same
  Zod contract used by the browser client.
- When credentials are stored, the system shall store a memory-hard password
  hash and never return or log password material.
- When a session is created, the system shall return only an opaque session
  token in an HttpOnly cookie and store only its SHA-256 digest.
- When a state-changing cookie-authenticated request is received, the server
  shall enforce same-origin request metadata before executing business logic.
- When authentication repeatedly fails, the API shall rate-limit the source and
  return a generic error that does not disclose account existence.
- When PostgreSQL or configuration is unavailable, readiness shall fail without
  exposing credentials or internal error details.

## Architecture

### Frontend

- React login and registration forms use shared Zod schemas for immediate
  feedback, while treating server validation as authoritative.
- The API client always uses `credentials: "include"`, handles structured API
  errors, and never stores session tokens in JavaScript-accessible storage.
- Loading, field-error, generic-error, and authenticated states are explicit and
  announced accessibly.

### Backend

- `packages/database` owns pool creation, transaction boundaries, migration
  execution, and parameterized user/session repositories.
- `packages/auth` owns password hashing, opaque sessions, rate limiting, auth
  service behavior, and HTTP route handling.
- `packages/contracts` owns Zod request/response schemas and the stable API error
  envelope.
- The profile API remains the composition root. Extension contributions are
  inserted only at named template slots; arbitrary code execution is forbidden.

### Security checkpoint

| Area | Decision |
|---|---|
| Authentication | Opaque random session token; only SHA-256 digest persisted |
| Passwords | Node `scrypt` with per-password random salt and constant-time comparison |
| Authorization | `/me` resolves identity exclusively from the persisted session |
| Validation | Shared strict Zod schemas on client and server |
| SQL injection | `pg` parameter placeholders only; migration identifiers are not user input |
| CSRF | HttpOnly `SameSite=Lax` cookie plus Origin/Referer same-origin enforcement on mutations |
| XSS | React encoding, no HTML injection, CSP/security headers from the API |
| Brute force | Bounded in-memory limiter by normalized source key; production scaling requires shared storage |
| Data exposure | User DTO allowlist excludes password hashes and session digests |
| Logging | Auth success/failure/logout events without email, password, cookie, or token values |
| Secrets | `DATABASE_URL` and production origins come from validated environment variables; opaque sessions need no signing secret |
| Errors | Stable public envelope with request ID; internal exceptions remain server-side |

## Data model

### users

- `id UUID PRIMARY KEY`
- `email_normalized TEXT UNIQUE`
- `email_display TEXT`
- `password_hash TEXT`
- `role TEXT CHECK (role IN ('user', 'admin'))`
- `created_at TIMESTAMPTZ`

### sessions

- `id UUID PRIMARY KEY`
- `user_id UUID REFERENCES users(id) ON DELETE CASCADE`
- `token_digest TEXT UNIQUE`
- `expires_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ`

## API

| Method | Path | Authentication | Result |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public, rate-limited | `201` user DTO + session cookie |
| POST | `/api/v1/auth/login` | Public, rate-limited | `200` user DTO + session cookie |
| POST | `/api/v1/auth/logout` | Session + same-origin | `204` and cleared cookie |
| GET | `/api/v1/auth/me` | Session | `200` user DTO or `401` |
| GET | `/health` | Public | Process health |
| GET | `/ready` | Public | Database readiness |

## Error policy

- `400` malformed JSON.
- `401` missing/invalid session or invalid credentials.
- `409` registration email conflict.
- `422` schema validation failure.
- `429` rate limit exceeded with `Retry-After`.
- `500` unexpected internal failure with a request ID and no internal details.
- `503` failed readiness.

## Implementation plan

- [x] Add safe extension contributions to the generator.
- [x] Add PostgreSQL module and migrations.
- [x] Upgrade shared contracts to Zod.
- [x] Add auth service, HTTP routes, and browser UI.
- [x] Add unit, integration, contract, and negative tests.
- [x] Add Docker Compose and operational documentation.
- [x] Generate, install, audit, migrate, test, and build a reference project.

## Known boundaries

- Email verification, password reset, social auth, MFA, and distributed rate
  limiting are intentionally deferred modules.
- The initial Docker configuration is local-development infrastructure, not a
  production deployment specification.
