# Transactional email outbox design

## Requirements

- When account state creates or replaces an email token, the system shall
  persist the matching email job in the same PostgreSQL transaction.
- When an API request completes successfully, SMTP availability shall not be a
  prerequisite for preserving the email job.
- When workers run concurrently, each due job shall be leased by at most one
  worker at a time.
- When delivery fails, the system shall schedule bounded exponential retries
  and retain the final failure for operational inspection.
- When a worker terminates, it shall stop polling, finish or release current
  work through lease expiry, and close its database pool.
- When logs describe outbox activity, they shall not include recipients,
  rendered bodies, tokens, or SMTP credentials.

## Architecture

### Frontend

No new controls are required. Existing verification and recovery forms retain
their generic accepted responses. Delivery failures remain operational state
and are not exposed as account-existence signals.

### Backend

- `transactional_email_outbox` stores the recipient, template identifier,
  opaque template payload, availability time, attempts, lease, and terminal
  status.
- Account-token issuance and outbox insertion share a checked-out PostgreSQL
  client and transaction.
- Workers claim jobs with `FOR UPDATE SKIP LOCKED`, set a short lease, render
  templates only after claiming, and mark delivery using the lease owner.
- Failed jobs use exponential backoff capped by configuration. After the
  configured attempt limit, they remain in `failed` state for inspection.
- A standalone worker process is started with `npm run email:worker`.

### Security

- Only allowlisted template identifiers are accepted.
- Payload shape is validated at the worker boundary before rendering.
- SQL is parameterized; workers cannot claim terminal jobs.
- Lease-owner predicates prevent stale workers from completing another
  worker's renewed claim.
- Error details are reduced to a bounded non-sensitive category; raw SMTP
  responses are not persisted or logged.
- Outbox tables and operational access are backend-only. No public endpoint
  returns recipient or payload data.

## Failure and consistency model

The database transaction guarantees that account-token state and its email job
either both commit or both roll back. SMTP itself cannot participate in that
transaction, so delivery is at-least-once: a worker may send successfully and
fail before marking the row delivered. Email templates and links must therefore
tolerate duplicates; account tokens remain single-use.

Expired leases make crashed jobs available again. Terminal failed rows are not
automatically deleted. Delivered and failed retention are explicit operations.

## Acceptance criteria

- Token issuance and outbox enqueue use one transaction.
- Two concurrent claims cannot return the same job.
- A stale lease owner cannot acknowledge or reschedule a job.
- Retry delay grows exponentially and respects configured bounds.
- Invalid payloads become terminal failures without reaching SMTP.
- Logs and public APIs contain no recipient, token, body, payload, or SMTP
  error text.
- Unit, migration, repository, and PostgreSQL integration tests pass.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related operations: `docs/development/account-security-operations.md`
