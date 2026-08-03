# Production observability design

## Requirements

- While any generated service is running, when it emits an operational event,
  the system shall write one machine-readable JSON record with service,
  environment, severity, timestamp, event name, and correlation identifiers.
- When untrusted or nested fields contain credentials, tokens, cookies,
  authorization values, email addresses, or password material, the logger shall
  redact them before serialization.
- When an HTTP request reaches the API, the system shall accept only a bounded,
  syntactically safe `x-request-id` or generate a UUID, return it to the client,
  and attach it to request completion and failure events.
- When operators scrape `/metrics`, the API shall expose bounded-label
  Prometheus text for request count, latency, in-flight work, and process health.
- When Kubernetes or Docker probes `/health`, the endpoint shall report process
  liveness without contacting dependencies. When `/ready` is probed, it shall
  fail closed if a required dependency is unavailable without exposing internal
  connection details.
- While the email worker processes an outbox job, its events and counters shall
  share a job correlation identifier and shall never include recipient or
  decrypted message content.
- When SIGINT or SIGTERM is received, services shall stop accepting work, drain
  bounded in-flight work, close pools, and emit lifecycle events.
- When an unexpected error is captured, the default reporter shall log a safe
  error classification and fingerprint; an external error tracker may be
  connected through an explicit adapter without becoming a required vendor.

## Architecture

### Frontend

- API responses continue to expose `x-request-id`, allowing support correlation
  without rendering internal traces or error details.
- No telemetry SDK or user tracking is added to the browser by default. Product
  analytics and browser error reporting require separate consent and privacy
  decisions.

### Backend

- `packages/observability` owns the logger, recursive redaction, safe error
  normalization, request context, in-memory metrics registry, and reporter port.
- The API owns HTTP middleware integration and probe routes.
- Workers own job-level context and lifecycle metrics.
- Metric labels are allowlisted and low-cardinality; request IDs, user IDs, job
  IDs, raw URLs, and exception messages are forbidden as labels.

### Security

- Probe and metric endpoints are read-only and return no secrets or topology.
- Request IDs are validated for length and character set to prevent log
  injection and unbounded cardinality.
- Redaction is recursive, handles arrays and circular objects, and matches
  sensitive key fragments case-insensitively.
- Error stacks are disabled in production JSON output by default.
- Authentication events retain only opaque correlation identifiers; audit data
  remains in the existing privacy-limited security event store.
- Metrics are suitable for a private service network. Public deployments must
  protect `/metrics` at the ingress or scrape a private listener.

## Error and degradation behavior

- Serialization failure produces a minimal valid fallback record.
- Reporter failures are swallowed after a safe local warning so telemetry
  cannot crash request handling.
- Readiness returns `503` with dependency names and coarse states only.
- Metrics collection remains process-local; aggregation belongs to the metrics
  backend and multi-process deployments must scrape each instance.

## Implementation plan

1. Expand the observability package and unit tests.
2. Contribute API imports and request middleware through module slots.
3. Add correlated worker lifecycle and delivery metrics.
4. Add Docker health checks and CI smoke assertions.
5. Document dashboards, alerts, incident triage, privacy, and retention.
6. Generate the full-stack example and run typecheck, tests, E2E, build, audit,
   template verification, and smoke probes.

## Acceptance criteria

- Nested secrets and PII are demonstrably redacted in tests.
- Every API response carries a valid request ID and request logs share it.
- `/health`, `/ready`, and `/metrics` have deterministic tests.
- Metric output cannot contain raw route parameters or correlation IDs.
- Worker tests cover success, failure, lifecycle, and safe fields.
- Container health checks exercise liveness/readiness as appropriate.
- Generated CI runs an observability smoke test.
- Local and incident-response documentation states ownership and residual risk.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related modules: `observability`, `database-postgres`, `transactional-email`
