import assert from "node:assert/strict";
import test from "node:test";
import { readRateLimitConfig } from "./config.js";
import { rateLimitKey } from "./key.js";
import { MemoryRateLimiter } from "./memory.js";

const secret = "unit-test-rate-limit-secret-32-characters";

test("memory adapter enforces the exact fixed-window boundary", async () => {
  const limiter = new MemoryRateLimiter("test", secret);
  const policy = { limit: 2, windowMs: 60_000 };
  assert.equal((await limiter.consume("login", "raw-ip-address", policy, 1)).allowed, true);
  assert.equal((await limiter.consume("login", "raw-ip-address", policy, 2)).allowed, true);
  const denied = await limiter.consume("login", "raw-ip-address", policy, 3);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 60);
  assert.equal((await limiter.consume("login", "raw-ip-address", policy, 60_001)).allowed, true);
});

test("route scopes remain independent", async () => {
  const limiter = new MemoryRateLimiter("test", secret);
  const policy = { limit: 1, windowMs: 60_000 };
  await limiter.consume("login", "subject", policy, 1);
  assert.equal((await limiter.consume("login", "subject", policy, 2)).allowed, false);
  assert.equal((await limiter.consume("forgot", "subject", policy, 2)).allowed, true);
});

test("constructed keys exclude raw subjects", () => {
  const key = rateLimitKey("product", "login", "203.0.113.10", secret);
  assert.match(key, /^product:rate-limit:login:[a-f0-9]{64}$/);
  assert.doesNotMatch(key, /203\.0\.113\.10/);
});

test("configuration requires explicit secrets and Valkey URL", () => {
  assert.throws(() => readRateLimitConfig({ RATE_LIMIT_BACKEND: "memory" }), /RATE_LIMIT_KEY_SECRET/);
  assert.throws(() => readRateLimitConfig({ RATE_LIMIT_BACKEND: "valkey", RATE_LIMIT_KEY_SECRET: secret }), /VALKEY_URL/);
  assert.equal(readRateLimitConfig({ RATE_LIMIT_BACKEND: "memory", RATE_LIMIT_KEY_SECRET: secret }).backend, "memory");
});
