import assert from "node:assert/strict";
import test from "node:test";
import { apiError, apiErrorSchema, healthResponse, loginRequestSchema, paginationQuerySchema, registerRequestSchema, userDtoSchema } from "./index.js";

test("health response preserves its contract", () => assert.deepEqual(healthResponse("ok"), { status: "ok" }));

test("registration normalizes email and rejects unknown input", () => {
  const parsed = registerRequestSchema.parse({ email: " User@Example.COM ", password: "CorrectHorse7", });
  assert.equal(parsed.email, "user@example.com");
  assert.equal(registerRequestSchema.safeParse({ ...parsed, admin: true }).success, false);
});

test("login accepts legacy passwords without weakening registration policy", () => {
  assert.equal(loginRequestSchema.safeParse({ email: "user@example.com", password: "old" }).success, true);
  assert.equal(registerRequestSchema.safeParse({ email: "user@example.com", password: "old" }).success, false);
});

test("user DTO excludes persistence-only fields", () => {
  assert.equal(userDtoSchema.safeParse({
    id: "018f22ec-8dc2-7d20-8000-000000000001",
    email: "user@example.com", role: "user", createdAt: new Date().toISOString(), passwordHash: "secret"
  }).success, false);
});

test("API errors require a support request ID and reject extra fields", () => {
  const value = apiError({ code: "UNAUTHENTICATED", message: "Authentication required", requestId: "request-123" });
  assert.equal(apiErrorSchema.safeParse(value).success, true);
  assert.equal(apiErrorSchema.safeParse({ ...value, stack: "internal" }).success, false);
});

test("pagination clamps the public upper bound", () => {
  assert.deepEqual(paginationQuerySchema.parse({}), { page: 1, limit: 20 });
  assert.equal(paginationQuerySchema.safeParse({ page: 1, limit: 101 }).success, false);
});
