# Production Docker deployment design

## Requirements

- When the Docker adapter is selected, the generator shall produce separately
  deployable API/worker and webapp images plus production service composition.
- Runtime containers shall run as non-root, use read-only filesystems where
  practical, drop Linux capabilities, enable `no-new-privileges`, and expose
  only the reverse proxy publicly.
- Builds shall bundle TypeScript entry points, install dependencies from the
  lockfile, exclude development tools from runtime, and contain no environment
  files or source-control metadata.
- Configuration shall fail closed when production secrets or public origins are
  missing; example files shall contain placeholders, never reusable secrets.
- Database migrations shall run as an explicit one-shot job before API and
  worker startup.
- Liveness shall test the process, readiness shall test required dependencies,
  and Compose shall order startup using health and completion conditions.
- The reverse proxy shall serve immutable frontend assets, apply browser
  security headers, proxy API routes, and keep metrics off the public surface.
- Shutdown shall allow API and worker processes to drain before Compose sends a
  forced termination.

## Architecture

### Frontend

- Vite assets are compiled in a build stage and served by unprivileged nginx.
- `/api/`, `/health`, and `/ready` proxy to the API; `/metrics` is not exposed.
- SPA fallback applies only to frontend routes.

### Backend

- esbuild produces self-contained API and worker entry bundles while external
  npm dependencies remain in pruned production `node_modules`.
- PostgreSQL and Valkey use internal networks and persistent PostgreSQL storage.
- SMTP remains an external production dependency configured through environment
  variables; the local Mailpit service is excluded.

### Security checkpoint

- Authentication and authorization remain application concerns and unchanged.
- Only ports 8080/8443 may be published by the operator-facing proxy layer.
- Database, Valkey, API, worker health, and metrics remain private.
- Secrets are injected at runtime; Compose interpolation validates required
  values before containers start.
- CSP, framing, MIME sniffing, referrer, permissions, and cache headers are set
  at the reverse proxy.
- Image tags are baseline defaults; production promotion must pin reviewed image
  digests and scan the resulting images.

## Failure and rollback

- Failed migrations prevent API/worker startup.
- Failed readiness prevents proxy traffic without restarting healthy processes.
- Release rollback uses the previous immutable image tag. Database migrations
  must be backward-compatible; destructive rollback is never automatic.
- PostgreSQL volume deletion is outside normal deployment and rollback commands.

## Acceptance criteria

- Adapter composition is optional and leaves core modules platform-neutral.
- Dockerfiles build from a freshly generated project with a reviewed lockfile.
- Static checks reject root runtime users, public dependency ports, missing
  health checks, missing capability drops, and copied `.env` files.
- Runtime smoke proves migration completion, API readiness, frontend response,
  security headers, and clean shutdown.
- Operator documentation covers secrets, TLS boundary, deploy, rollback,
  backups, observability, and image promotion.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related architecture: `docs/architecture/ai-engineering-harness.md`
