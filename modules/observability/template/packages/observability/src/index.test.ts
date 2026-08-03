import assert from "node:assert/strict";
import test from "node:test";
import { createLogger, createMetricsRegistry, createSafeErrorReporter, redact, requestIdFrom, safeError } from "./index.js";

test("recursively redacts secrets, PII, arrays, and circular values", () => {
  const input: Record<string, unknown> = { requestId: "request-42", nested: { accessToken: "secret", emailAddress: "person@example.test" }, rows: [{ cookie: "session" }] };
  input.circular = input;
  assert.deepEqual(redact(input), { requestId: "request-42", nested: { accessToken: "[REDACTED]", emailAddress: "[REDACTED]" }, rows: [{ cookie: "[REDACTED]" }], circular: "[CIRCULAR]" });
});

test("logger combines safe base and event context", () => {
  const records: Record<string, unknown>[] = [];
  const logger = createLogger({ service: "api", authorization: "hidden" }, (record) => records.push(record));
  logger.child({ requestId: "request-42" }).log("info", "request_completed", { statusCode: 200 });
  assert.equal(records[0]?.service, "api");
  assert.equal(records[0]?.authorization, "[REDACTED]");
  assert.equal(records[0]?.requestId, "request-42");
});

test("request IDs accept bounded safe values and replace untrusted input", () => {
  assert.equal(requestIdFrom("request-123"), "request-123");
  assert.match(requestIdFrom("bad\nvalue"), /^[0-9a-f-]{36}$/);
});

test("safe errors expose classification rather than messages or stacks", () => {
  const error = Object.assign(new Error("database password leaked"), { code: "ECONNREFUSED" });
  assert.deepEqual(Object.keys(safeError(error)).sort(), ["code", "fingerprint", "name"]);
});

test("metrics render deterministic low-cardinality Prometheus text", () => {
  const registry = createMetricsRegistry();
  const requests = registry.counter("http_requests_total", "Completed requests");
  const active = registry.gauge("http_requests_active", "Active requests");
  requests.add(1, { method: "GET", route: "/health", status: "200" });
  requests.add(2, { status: "200", route: "/health", method: "GET" });
  active.set(0);
  const output = registry.render();
  assert.match(output, /http_requests_total\{method="GET",route="\/health",status="200"\} 3/);
  assert.doesNotMatch(output, /requestId/);
});

test("external reporter failures do not escape", async () => {
  const reporter = createSafeErrorReporter({ capture() { throw new Error("vendor token"); } });
  await assert.doesNotReject(Promise.resolve(reporter.capture(new Error("application secret"), { requestId: "request-42", password: "hidden" })));
});
