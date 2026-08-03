# Production Docker deployment

## Prerequisites

Select the `docker-production` adapter with the full-stack modules, generate the
project, run `npm install --ignore-scripts`, review the lockfile, and commit it.
Production image builds use `npm ci` and intentionally fail without that
reviewed lockfile.

Copy `.env.production.example` to `.env.production`, restrict its filesystem
permissions, and replace every `REPLACE` value. Prefer an orchestrator secret
store that materializes the file only for Compose startup. Never commit it.

## Build and validate

```text
npm run deployment:validate
docker build -f Dockerfile.api-worker -t registry.example/app:<immutable-tag> .
docker build -f Dockerfile.webapp -t registry.example/web:<immutable-tag> .
```

Set `APP_IMAGE` and `WEB_IMAGE` to immutable tags or reviewed digests. Scan both
resulting images and generate an SBOM in the organization image pipeline before
promotion. The baseline uses maintained major image tags for portability;
production promotion must pin digests according to the update policy.

## TLS and network boundary

Compose publishes web traffic on loopback port 8080 by default. Terminate TLS
in a host proxy, load balancer, or ingress and forward only to that port. Do not
publish PostgreSQL, Valkey, API, worker health, or metrics ports. Set
`APP_ORIGIN` and `PUBLIC_APP_URL` to the final HTTPS origin.

## Deploy

```text
docker compose --env-file .env.production -f docker-compose.production.yml pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d --wait
npm run deployment:smoke
```

The one-shot migration service must complete before API and worker start. API
readiness waits for PostgreSQL and Valkey; the reverse proxy waits for API
readiness. Treat failed migrations as a stopped release, not as a reason to
skip the gate.

## Rollback

1. Preserve logs, health state, image identifiers, and migration output.
2. Restore the previous `APP_IMAGE` and `WEB_IMAGE` immutable identifiers.
3. Run `up -d --wait` and the smoke command again.
4. Do not automatically reverse database migrations. Release migrations must
   remain backward-compatible until the previous application version is no
   longer a rollback target.

Never use `down --volumes` during deploy or rollback. PostgreSQL backup and
restore procedures remain a separate required operations capability.

## Security and operations

- Containers run non-root with dropped capabilities and no privilege escalation.
- Runtime filesystems are read-only except bounded tmpfs and PostgreSQL data.
- `/metrics` is blocked by the public proxy; scrape private service endpoints.
- SMTP is external in production; Mailpit is not part of this composition.
- Rotate database, Valkey, hashing, SMTP, and outbox-encryption secrets under a
  documented dual-read/re-encryption plan where applicable.
- Review CSP if new asset, analytics, image, or API origins are introduced.
- Configure log retention and alerts using
  `docs/development/observability-operations.md`.

## Harness evidence

The harness considers a deployment change complete only when design and threat
boundaries are current, `deployment:validate` passes, both images build, Compose
reaches healthy state, `deployment:smoke` passes, the standard verification
suite remains green, and rollback/residual risks are documented. The generated
`production-images.yml` applies the same gates in CI without publishing images.
Publishing or deploying remains an explicit user-authorized action.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/production-docker-deployment-design.md`
