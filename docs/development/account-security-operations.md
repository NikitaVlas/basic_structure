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
EMAIL_OUTBOX_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
```

Generate the outbox encryption key once per environment:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Apply migrations, then run the API and worker as separate processes:

```text
npm run db:migrate
npm run email:worker
```

Mailpit is available at `http://127.0.0.1:8025`. Stop it with
`npm run email:down`. Mailpit is a development capture service, not a
production mail relay.

## Required production configuration

- Set `PUBLIC_APP_URL` to the canonical HTTPS application origin.
- Set `APP_ORIGIN` to the exact browser origin allowed to mutate cookie state.
- Generate an independent random `IP_HASH_SECRET` with at least 32 characters.
- Generate and store an independent `EMAIL_OUTBOX_ENCRYPTION_KEY`. The API and
  every worker replica must use the same key. Loss of the key makes pending
  messages intentionally unreadable.
- Configure authenticated SMTP credentials through the deployment secret
  manager; never commit them to `.env` or source control.
- Set `NODE_ENV=production` so the API issues the Secure host-only cookie.
- Replace the process-local rate limiter before running multiple API replicas.

Run database migrations before shifting traffic. Migration
`002_account_security.sql` adds verification state, one-time token digests,
session metadata, and security audit events. Migration
`003_transactional_email_outbox.sql` adds encrypted durable email jobs.

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
- Account-token updates and encrypted outbox jobs commit in one transaction.
- Concurrent workers claim with leases and `SKIP LOCKED`; stale workers cannot
  acknowledge a job reclaimed by another process.

## Maintenance

Schedule deletion of expired rows from `account_tokens` and `sessions` using
the repository cleanup methods. Delete delivered and terminal failed outbox
rows only after the chosen operational retention window. Define an audit-event retention
period appropriate to product and regulatory requirements. Rotate
`IP_HASH_SECRET` only with an explicit privacy/incident plan because rotation
breaks correlation with earlier pseudonyms.

Monitor counts and age grouped by outbox `status`, attempts approaching
`EMAIL_WORKER_MAX_ATTEMPTS`, reset-request volume, repeated login failures, and
unusual session revocation activity. Alert when pending jobs are older than the
expected delivery objective or any job becomes terminally failed. Do not add
recipients, ciphertext, payloads, or SMTP responses to logs. Back up and
restore-test PostgreSQL before production use.

## Residual risks

Delivery is at-least-once. SMTP can accept a message immediately before a
worker loses its lease or database connection, so recipients may receive a
duplicate. Verification and reset tokens are single-use, but templates should
remain duplicate-tolerant. Key rotation and re-encryption of pending jobs are
not automated; rotate through an explicit migration procedure.

The starter also does not include MFA, breached-password screening, distributed
rate limiting, automated browser E2E tests, or a production email provider
adapter. Treat those as explicit deployment decisions, not implicit coverage.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specifications: `docs/specifications/account-recovery-design.md`,
  `docs/specifications/transactional-email-outbox-design.md`
