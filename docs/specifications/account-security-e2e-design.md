# Account security browser E2E design

## Requirements

- When the E2E suite starts, it shall provision isolated PostgreSQL, Valkey,
  and Mailpit services, apply migrations, and start API, worker, and webapp
  processes with test-only configuration.
- When the suite finishes or fails, it shall stop application processes and
  remove only its compose services and networks.
- When a browser registers or requests recovery, the test shall retrieve the
  delivered message from Mailpit and follow the real application link.
- When a critical flow fails, Playwright shall retain a trace, screenshot, and
  video while successful runs remain lightweight.
- When tests run in CI, they shall use the same root command as local runs.

## Architecture

### Frontend

Playwright drives the accessible UI by roles and labels. Journeys cover account
creation, email verification, sign-out, forgot/reset, multiple sessions,
session revocation, security activity, keyboard focus, and a mobile viewport.
Tests do not call account mutation APIs directly.

### Backend and services

- A generated `apps/e2e` workspace owns Playwright configuration and tests.
- Global setup runs three allowlisted Docker Compose files, migrates the test
  database, truncates test state, and clears Mailpit.
- Playwright `webServer` runs API, email worker, and Vite together through a
  supervised process group; Playwright terminates it after the suite.
- Global teardown removes only the named E2E compose services/networks.
- Mailpit API polling has a bounded timeout and selects messages by recipient
  and expected application path.

### Security

- The suite refuses any database URL that is not loopback and does not target
  the dedicated `app_test` database.
- All test credentials and encryption keys are fixed local-only values in an
  explicitly named `.env.e2e`; production credentials are never read.
- Browser diagnostics can contain test-only links/tokens and are ignored by
  Git; CI artifacts are uploaded only on failure with short retention.
- Tests use unique randomized email addresses and never rely on developer data.
- Service cleanup resolves fixed compose files under the generated root and
  never performs recursive filesystem deletion.

## Acceptance criteria

- One browser journey completes registration, real Mailpit verification,
  forgot/reset, new-password login, second-session creation and revocation.
- Security activity displays verification, password reset, login, and session
  revocation events without internal metadata.
- Keyboard focus and mobile layout smoke tests pass.
- Trace, screenshot, and video are retained only on failure.
- PostgreSQL, Valkey, and Mailpit containers are removed after the run.
- Typecheck, unit, Playwright, production build, and dependency audit pass.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related operations: `docs/development/browser-e2e.md`
