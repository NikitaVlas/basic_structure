# Distributed rate limiting design

## Requirements

- When multiple API replicas receive requests for the same protected subject,
  they shall share one atomic counter and expiry window.
- When local development does not provide Valkey, the system shall offer an
  explicitly selected in-memory adapter with the same contract.
- When the distributed backend is unavailable, anonymous credential and
  recovery endpoints shall fail closed with a generic `503`; authenticated
  verification resend may use its documented policy without exposing state.
- When a request is limited, the API shall return `429` and a bounded
  `Retry-After` value without revealing the counter or account existence.
- When keys are written to Valkey, they shall not contain raw IP addresses,
  emails, cookies, session tokens, or request bodies.

## Architecture

### Frontend

Existing forms already surface generic API errors and disable duplicate
submissions while a request is active. No new user input or trusted client-side
enforcement is introduced. `429` and backend-unavailable responses remain
server decisions.

### Backend

- `packages/rate-limit` defines an asynchronous adapter contract.
- The memory adapter provides deterministic local and unit-test behavior.
- The Valkey adapter executes an allowlisted Lua script atomically: increment,
  set expiry on first use, and return count plus remaining TTL.
- The auth composition root selects the adapter from validated environment
  configuration and closes it during graceful resource shutdown.
- Policies are route-scoped: registration, login, forgot-password,
  reset-password, and verification resend do not share counters.
- A non-sensitive readiness function checks the selected backend.

### Security

- Subjects are HMAC-SHA-256 pseudonyms generated with `RATE_LIMIT_KEY_SECRET`.
- Namespace and scope are validated against conservative character sets before
  key construction; user input never changes Lua source or key structure.
- Lua source is static and values are passed through `KEYS`/`ARGV`.
- All anonymous authentication and recovery policies fail closed when Valkey
  is selected but unavailable.
- Logs report backend/category only, not keys, subjects, IPs, emails, or
  counter values.

## Policy defaults

| Scope | Limit | Window | Backend failure |
|---|---:|---:|---|
| Register | 5 | 15 minutes | Closed |
| Login | 5 | 5 minutes | Closed |
| Forgot password | 5 | 15 minutes | Closed |
| Reset password | 5 | 15 minutes | Closed |
| Verification resend | 3 | 15 minutes | Closed |

The first implementation uses fixed windows because they are bounded,
predictable, and atomic with one key. A later sliding-window adapter can retain
the public contract.

## Acceptance criteria

- Memory and Valkey adapters produce the same allow/deny boundary.
- Two independent Valkey clients share the same limit.
- Every key has a TTL and contains only namespace, static scope, and HMAC.
- Backend failure returns `503`, never silently bypasses anonymous auth limits.
- `Retry-After` is positive and never exceeds the configured window.
- Readiness reports only ready/unavailable.
- Generated typecheck, unit, Valkey integration, audit, and production builds
  pass.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Reference: `docs/development/account-security-operations.md`
