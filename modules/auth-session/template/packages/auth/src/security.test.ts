import assert from "node:assert/strict";
import test from "node:test";
import { createSessionCookie, readSessionCookie } from "./cookies.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSessionToken, digestSessionToken } from "./session-token.js";

test("password hashes are salted and verifiable", async () => {
  const first = await hashPassword("CorrectHorse7");
  const second = await hashPassword("CorrectHorse7");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("CorrectHorse7", first), true);
  assert.equal(await verifyPassword("incorrect", first), false);
  assert.ok(!first.includes("CorrectHorse7"));
});

test("session persistence uses a digest instead of the opaque token", () => {
  const token = createSessionToken();
  const digest = digestSessionToken(token);
  assert.equal(digest.length, 64);
  assert.ok(!digest.includes(token));
});

test("production cookies use host-only security attributes", () => {
  assert.match(createSessionCookie("token", 60, true), /^__Host-session=.*; Path=\/; HttpOnly; SameSite=Lax; Max-Age=60; Secure$/);
});
