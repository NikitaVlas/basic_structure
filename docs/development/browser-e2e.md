# Browser E2E operations

## Scope

The `e2e-playwright` module validates the critical account-security journey in
Chromium: registration, email verification through Mailpit, password recovery,
sign-in, concurrent sessions, session revocation, and security activity. It
also includes keyboard-focus and mobile-viewport smoke coverage.

## Local execution

Docker Desktop must be running. After generating and installing a full-stack
project, install the pinned Playwright browser once:

```text
npx playwright install chromium
```

Run the isolated suite from the generated project root:

```text
npm run test:e2e
```

The command owns an isolated PostgreSQL database, Valkey, and Mailpit compose
project. It applies migrations, starts the API, email worker, and webapp on
loopback-only test ports, then removes the containers and volumes after the
application processes stop. Fixed credentials in `.env.e2e` are test-only.
Never point this suite at development, staging, or production infrastructure.

## Failure diagnostics

Playwright keeps failure-only screenshots, video, traces, and an error context
under `apps/e2e/test-results/`. Open a trace with:

```text
npx playwright show-trace apps/e2e/test-results/<test>/trace.zip
```

Artifacts can contain synthetic test account data and application responses.
Keep them out of source control and apply the CI retention policy.

## CI

The generated `.github/workflows/e2e.yml` installs Chromium and runs the same
command on Ubuntu. Failure diagnostics are uploaded only when the suite fails.
The workflow does not require shared service credentials because all backing
services are ephemeral and local to the runner.

## Residual coverage

This suite is a critical-journey check, not exhaustive cross-browser or visual
regression coverage. Add projects for other supported browsers, accessibility
auditing, and approved screenshot baselines when product requirements demand
them.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/account-security-e2e-design.md`
