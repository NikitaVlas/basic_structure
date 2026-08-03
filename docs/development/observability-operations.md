# Observability operations

## Signals

Generated full-stack projects expose newline-delimited JSON logs, Prometheus
text at API and worker `GET /metrics`, process liveness at `GET /health`, and
dependency readiness at `GET /ready`.

Every API response includes `x-request-id`. Supply an existing safe request ID
at trusted service boundaries or use the returned value in support reports.
Invalid, multiline, or oversized IDs are replaced with a UUID.

## Deployment

Route stdout to a structured log backend without parsing message text. Preserve
`timestamp`, `level`, `message`, `service`, `environment`, and correlation
fields. Never enable full request/response body capture.

Scrape API metrics on its private service address. The email worker server
binds to loopback on `EMAIL_WORKER_HEALTH_PORT` (default `3001`); expose it only
through a sidecar or pod-local scraper. Protect `/metrics` at the ingress if the
API itself is public.

Use `/health` for liveness and `/ready` for traffic admission. Do not restart a
live process solely because readiness is temporarily degraded; investigate its
dependency first.

## Minimum dashboard and alerts

Dashboard HTTP rate, error ratio, average latency (duration sum divided by
count), active requests, email outcomes, worker poll failures, worker running
state, and PostgreSQL/Valkey readiness. The dependency-free baseline provides
averages; reviewed Prometheus/OpenTelemetry histogram adapters are needed for
accurate p95/p99 across replicas.

Start with alerts for readiness unavailable for five minutes, HTTP 5xx above
2% for ten minutes with a traffic floor, worker running below 1 for two
minutes, sustained poll failures, and outbox age beyond the product SLO. Tune
thresholds from measured baselines rather than paging on a single event.

## Incident triage

1. Record service, environment, time window, and a request ID.
2. Check liveness and readiness without copying connection strings or headers.
3. Compare request rate, errors, active work, and dependency state.
4. Query JSON logs by `requestId`, `jobId`, or stable event name.
5. Correlate repeating error fingerprints with the deployment version.
6. Mitigate using rollback/degradation procedures and retain only a
   privacy-reviewed diagnostic sample.

## Privacy and retention

The logger recursively redacts key names matching email, cookies, credentials,
sessions, passwords, secrets, authorization, and tokens. This is defense in
depth, not permission to log arbitrary objects. Prefer explicit allowlisted
fields; never log bodies, SMTP messages, database rows, or environment objects.

Set retention from product privacy requirements, restrict access, audit
queries, and delete expired data. External error tracking requires an explicit
adapter, secret configuration, data-processing review, and sampling policy.

## Verification and residual risks

`npm test` covers redaction, error normalization, correlation, metrics output,
bounded labels, and reporter isolation. Generated GitHub CI runs the smoke
assertions through `npm run verify`.

Metrics are process-local and reset on restart. Redaction cannot identify
sensitive values under misleading keys. Browser telemetry, distributed traces,
percentile SLOs, and vendor dashboards remain deliberate optional adapters.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/production-observability-design.md`
