# Persistence and authentication setup

## Generated architecture

The `database-postgres` module owns PostgreSQL connectivity, migrations, and
repositories. The `auth-session` module owns credential and session behavior.
Shared Zod schemas remain in `packages/contracts`; the API is the composition
root and the React client never receives a session token.

## Local setup

After generating the project:

```text
npm install --ignore-scripts
```

Review and commit the resulting `package-lock.json`, then use `npm ci` for
subsequent clean installs and update generated CI accordingly.

Create the local API environment file:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

```bash
cp apps/api/.env.example apps/api/.env
```

The example credentials are local-only and must never be reused in production.

Start PostgreSQL and apply migrations:

```text
npm run db:up
npm run db:migrate
```

Start the API and webapp in separate terminals:

```text
npm run dev --workspace @<project-name>/api
npm run dev --workspace @<project-name>/webapp
```

## Integration tests

The test database uses a separate port and tmpfs storage:

```text
npm run db:test:up
npm run test:integration
npm run db:test:down
```

Integration tests apply migrations themselves and truncate auth data before the
flow. They must never target a development or production database.

The template currently pins PostgreSQL `18.4-alpine`, the current supported
minor used during validation. Review the official
[PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
for security/bugfix minor updates and test upgrades before changing the image.

## Security behavior

- Registration uses the strict shared password policy; login remains compatible
  with older valid password records.
- Passwords use salted scrypt hashes.
- Browser sessions are random opaque tokens; PostgreSQL stores only SHA-256
  digests.
- Cookies are HttpOnly and SameSite=Lax. Production uses the Secure
  `__Host-session` cookie name.
- Cookie-authenticated mutations require the configured origin.
- Authentication failures are rate-limited and do not reveal account existence.
- User responses are allowlisted Zod DTOs without password or session fields.
- Logs contain request IDs and event names, not email addresses or credentials.
- Verification and reset links use one-time opaque tokens stored only as
  digests; reset atomically revokes every active session.
- Users can review and revoke owned sessions and see privacy-limited security
  events.

The selectable rate-limit module supports process-local memory and atomic
Valkey counters. Use Valkey before horizontally scaling the API; see
`docs/development/distributed-rate-limiting.md`.

## Operations

- `GET /health` checks the HTTP process.
- `GET /ready` checks PostgreSQL and returns `503` without internal details when
  the database is unavailable.
- Apply migrations as a release step before shifting traffic.
- Back up and test restore procedures before storing production data.
- Use HTTPS in production; the production cookie is intentionally unusable over
  plain HTTP.

## Deferred capabilities

Social login, MFA, breached-password screening, account lockout policy, and
broader cross-browser coverage remain explicit future capabilities. See
`docs/development/account-security-operations.md` for setup and residual risks.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/persistence-auth-design.md`
