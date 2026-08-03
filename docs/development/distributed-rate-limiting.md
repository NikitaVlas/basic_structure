# Distributed rate limiting operations

## Local setup

The generated project defaults to the in-memory adapter. It is deterministic
and requires no service, but counters are isolated per API process. To test the
distributed adapter:

```text
npm run rate-limit:up
```

Set the API environment:

```text
RATE_LIMIT_BACKEND=valkey
VALKEY_URL=redis://127.0.0.1:56379
RATE_LIMIT_NAMESPACE=<environment-and-application-name>
RATE_LIMIT_KEY_SECRET=<at-least-32-random-characters>
```

Stop the local service with `npm run rate-limit:down`. The compose service is
bound to loopback, disables persistence, and uses `noeviction`: memory pressure
causes write errors and therefore fail-closed API responses instead of silently
dropping protection keys.

## Production requirements

- Use a dedicated managed Valkey deployment or isolated key namespace.
- Use encrypted transport (`rediss://`) and managed ACL credentials.
- Generate a separate `RATE_LIMIT_KEY_SECRET` for every environment and store
  it in the deployment secret manager.
- Keep the same namespace and secret across all API replicas that must share
  counters.
- Configure `noeviction`, memory alerts, connection limits, and high
  availability. Evicting active keys weakens enforcement.
- Validate behavior during Valkey failover before production rollout.

The API readiness endpoint is `GET /api/v1/auth/rate-limit-ready`. It returns
only `ready` or `unavailable`; it does not expose URLs, namespaces, subjects,
keys, or counts.

## Security behavior

All subjects are HMAC-SHA-256 pseudonyms before key construction. Raw IP
addresses, emails, user IDs, and reset tokens are not written to Valkey. Login,
forgot-password, and reset flows use both source counters and account/token
counters to reduce distributed attacks across multiple source addresses.

Protected authentication and recovery routes fail closed with a generic `503`
when the configured Valkey backend is unavailable. A denied request returns
`429` and a bounded `Retry-After` value.

## Reverse proxies

The starter intentionally uses the direct socket address and does not trust
forwarded headers. Behind a reverse proxy, this may group all clients under the
proxy address. Do not start trusting `X-Forwarded-For` globally: add a
deployment-specific trusted-proxy adapter with an explicit proxy allowlist, or
enforce the source-IP layer at the gateway while retaining account counters in
the application.

## Monitoring

Alert on readiness failures, `rate_limit_backend_unavailable` logs, unexpected
increases in `429`/`503`, Valkey rejected writes, memory saturation, latency,
connection exhaustion, and failover events. Logs intentionally omit keys,
subjects, source addresses, emails, tokens, and counter values.

## Residual limitations

The initial adapter uses fixed windows, which can permit bursts around a window
boundary. Policies are currently code-owned defaults rather than live dynamic
configuration. The memory adapter is not suitable for horizontally scaled
production authentication. Trusted-proxy extraction and gateway coordination
remain deployment-specific responsibilities.

## Document status

- Status: Active
- Owner: Project maintainers
- Last reviewed: 2026-08-03
- Related specification: `docs/specifications/distributed-rate-limit-design.md`
