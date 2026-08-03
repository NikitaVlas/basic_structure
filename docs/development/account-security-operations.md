# Account security operations

## Local email delivery

The generated project defaults to the privacy-safe `console` transport. It
records only the template name and does not print recipients, bodies, or raw
tokens. To inspect real development messages, start Mailpit:

```text
npm run email:up
```

Then set these values in `apps/api/.env`:

```text
EMAIL_TRANSPORT=smtp
EMAIL_SMTP_HOST=127.0.0.1
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_SECURE=false
EMAIL_FROM=no-reply@example.test
PUBLIC_APP_URL=http://localhost:5173
```

Mailpit is available at `http://127.0.0.1:8025`. Stop it with
`npm run email:down`. Mailpit is a development capture service, not a
production mail relay.

## Required production configuration

- Set `PUBLIC_APP_URL` to the canonical HTTPS application origin.
- Set `APP_ORIGIN` to the exact browser origin allowed to mutate cookie state.
- Generate an independent random `IP_HASH_SECRET` with at least 32 characters.
- Configure authenticated SMTP credentials through the deployment secret
  manager; never commit them to `.env` or source control.
- Set `NODE_ENV=production` so the API issues the Secure host-only cookie.
- Replace the process-local rate limiter before running multiple API replicas.

Run database migrations before shifting traffic. Migration
`002_account_security.sql` adds verification state, one-time token digests,
session metadata, and security audit events.

## Security and privacy behavior

- Verification and reset tokens contain 256 random bits. Only SHA-256 digests
  are stored, and successful consumption deletes the token atomically.
- Password reset changes the password and revokes every session in the same SQL
  statement.
- Forgot-password responses do not reveal whether an account exists.
- Session revocation includes the authenticated user ID in the delete predicate.
- Raw IP addresses are not stored; the API records an HMAC pseudonym using
  `IP_HASH_SECRET`.
- Public audit responses exclude request IDs, session IDs, metadata, emails,
  IP hashes, and token digests.

## Maintenance

Schedule deletion of expired rows from `account_tokens` and `sessions` using
the repository cleanup methods. Define and implement an audit-event retention
period appropriate to product and regulatory requirements. Rotate
`IP_HASH_SECRET` only with an explicit privacy/incident plan because rotation
breaks correlation with earlier pseudonyms.

Monitor email delivery failures, reset-request volume, repeated login failures,
and unusual session revocation activity without adding sensitive values to
logs. Back up and restore-test PostgreSQL before production use.

## Residual risks

The starter sends email synchronously and does not yet include a durable outbox.
A database write may succeed while SMTP delivery fails. Production systems
that require guaranteed delivery should add a transactional outbox, background
worker, retries with bounded backoff, and dead-letter visibility.

The starter also does not include MFA, breached-password screening, distributed
rate limiting, automated browser E2E tests, or a production email provider
adapter. Treat those as explicit deployment decisions, not implicit coverage.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/account-recovery-design.md`
