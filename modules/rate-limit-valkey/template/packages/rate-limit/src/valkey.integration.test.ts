import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ValkeyRateLimiter } from "./valkey.js";

const url = process.env.TEST_VALKEY_URL;

test("integration: independent clients share one atomic Valkey window", { skip: !url }, async () => {
  const namespace = `test-${randomUUID()}`;
  const secret = "integration-rate-limit-secret-32-characters";
  const first = new ValkeyRateLimiter(url!, namespace, secret);
  const second = new ValkeyRateLimiter(url!, namespace, secret);
  const policy = { limit: 3, windowMs: 10_000 };
  try {
    assert.equal(await first.ready(), true);
    assert.equal(await second.ready(), true);
    assert.equal((await first.consume("login", "shared-subject", policy)).allowed, true);
    assert.equal((await second.consume("login", "shared-subject", policy)).allowed, true);
    assert.equal((await first.consume("login", "shared-subject", policy)).allowed, true);
    const denied = await second.consume("login", "shared-subject", policy);
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSeconds >= 1 && denied.retryAfterSeconds <= 10);
    assert.equal((await second.consume("forgot", "shared-subject", policy)).allowed, true);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});
