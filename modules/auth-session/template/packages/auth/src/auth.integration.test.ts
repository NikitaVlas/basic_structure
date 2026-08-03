import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createDatabasePool, EmailOutboxRepository, runMigrations } from "@{{PROJECT_NAME}}/database";
import { EmailOutboxWorker, type TransactionalEmail } from "@{{PROJECT_NAME}}/email";
import { closeAuthResources, handleAuthRequest } from "./index.js";
import { digestOpaqueToken } from "./session-token.js";

const enabled = Boolean(process.env.TEST_DATABASE_URL);

test("integration: registration, session, generic login failure, CSRF, and logout", { skip: !enabled }, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.APP_ORIGIN = "http://localhost:5173";
  process.env.PUBLIC_APP_URL = "http://localhost:5173";
  process.env.EMAIL_FROM = "no-reply@example.test";
  process.env.EMAIL_TRANSPORT = "console";
  process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.IP_HASH_SECRET = "integration-test-secret-with-32-characters";
  const verificationPool = createDatabasePool({ max: 2 });
  await runMigrations(verificationPool);
  await verificationPool.query("TRUNCATE sessions, users RESTART IDENTITY CASCADE");

  const server = createServer(async (request, response) => {
    if (!(await handleAuthRequest(request, response))) response.writeHead(404).end();
  }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${baseUrl}${path}`, {
    method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:5173", ...headers }, body: JSON.stringify(body)
  });

  try {
    const registration = await post("/api/v1/auth/register", { email: " User@Example.com ", password: "CorrectHorse7" });
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get("set-cookie");
    if (!cookie?.startsWith("session=")) throw new Error("Registration did not return the session cookie");
    const cookieHeader = cookie.split(";", 1)[0]!;
    const token = cookieHeader.split("=", 2)[1]!;

    const stored = await verificationPool.query<{ token_digest: string; password_hash: string }>(
      "SELECT s.token_digest, u.password_hash FROM sessions s JOIN users u ON u.id = s.user_id"
    );
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0]!.token_digest.length, 64);
    assert.ok(!stored.rows[0]!.token_digest.includes(token));
    assert.ok(!stored.rows[0]!.password_hash.includes("CorrectHorse7"));

    const captured: TransactionalEmail[] = [];
    const worker = new EmailOutboxWorker(
      new EmailOutboxRepository(verificationPool),
      { async send(message) { captured.push(message); } },
      { pollMs: 100, batchSize: 10, leaseMs: 5000, maxAttempts: 3, baseRetryMs: 100, maxRetryMs: 1000 }
    );
    assert.equal(await worker.runOnce(), 1);
    assert.equal(captured[0]?.template, "verify-email");
    assert.equal(captured[0]?.to, "user@example.com");
    const delivered = await verificationPool.query<{ message_ciphertext: string; status: string }>(
      "SELECT message_ciphertext, status FROM transactional_email_outbox ORDER BY created_at LIMIT 1"
    );
    assert.equal(delivered.rows[0]?.status, "delivered");
    assert.doesNotMatch(delivered.rows[0]!.message_ciphertext, /user@example\.com/);

    const duplicate = await post("/api/v1/auth/register", { email: "user@example.com", password: "CorrectHorse7" });
    assert.equal(duplicate.status, 409);

    const missing = await post("/api/v1/auth/login", { email: "missing@example.com", password: "CorrectHorse7" });
    const wrong = await post("/api/v1/auth/login", { email: "user@example.com", password: "WrongPassword7" });
    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal((await missing.json()).error.message, (await wrong.json()).error.message);

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie: cookieHeader } });
    assert.equal(me.status, 200);
    const meBody = await me.json();
    assert.equal(meBody.user.email, "user@example.com");
    assert.equal(meBody.user.emailVerified, false);
    assert.equal("passwordHash" in meBody.user, false);
    const sessionsResponse = await fetch(`${baseUrl}/api/v1/auth/sessions`, { headers: { cookie: cookieHeader } });
    assert.equal(sessionsResponse.status, 200);
    const sessionsBody = await sessionsResponse.json();
    assert.equal(sessionsBody.sessions.length, 1);
    assert.equal(sessionsBody.sessions[0].current, true);
    assert.equal("token_digest" in sessionsBody.sessions[0], false);

    const verificationRequest = await post("/api/v1/auth/email/request", {}, { cookie: cookieHeader });
    assert.equal(verificationRequest.status, 202);
    const verificationToken = "verification-token-that-is-at-least-32-characters";
    await verificationPool.query(
      `INSERT INTO account_tokens (user_id, purpose, token_digest, expires_at)
       SELECT id, 'verify_email', $1, now() + interval '1 hour' FROM users WHERE email_normalized = $2
       ON CONFLICT (user_id, purpose) DO UPDATE SET token_digest = EXCLUDED.token_digest, expires_at = EXCLUDED.expires_at`,
      [digestOpaqueToken(verificationToken), "user@example.com"]
    );
    assert.equal((await post("/api/v1/auth/email/confirm", { token: verificationToken })).status, 204);
    const verified = await verificationPool.query<{ email_verified_at: Date | null }>("SELECT email_verified_at FROM users WHERE email_normalized = $1", ["user@example.com"]);
    assert.ok(verified.rows[0]?.email_verified_at);

    const missingRecovery = await post("/api/v1/auth/password/forgot", { email: "absent@example.com" });
    const existingRecovery = await post("/api/v1/auth/password/forgot", { email: "user@example.com" });
    assert.equal(missingRecovery.status, 202);
    assert.equal(existingRecovery.status, 202);
    assert.deepEqual(await missingRecovery.json(), await existingRecovery.json());

    const resetToken = "password-reset-token-that-is-at-least-32-characters";
    await verificationPool.query(
      `UPDATE account_tokens SET token_digest = $1, expires_at = now() + interval '10 minutes'
       WHERE purpose = 'reset_password'`,
      [digestOpaqueToken(resetToken)]
    );
    assert.equal((await post("/api/v1/auth/password/reset", { token: resetToken, password: "Replacement7Password" })).status, 204);
    assert.equal((await post("/api/v1/auth/password/reset", { token: resetToken, password: "Replacement7Password" })).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie: cookieHeader } })).status, 401);
    assert.equal((await post("/api/v1/auth/login", { email: "user@example.com", password: "CorrectHorse7" })).status, 401);
    const newLogin = await post("/api/v1/auth/login", { email: "user@example.com", password: "Replacement7Password" });
    assert.equal(newLogin.status, 200);
    const newCookie = newLogin.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(newCookie);
    const events = await fetch(`${baseUrl}/api/v1/auth/security-events`, { headers: { cookie: newCookie } });
    assert.equal(events.status, 200);
    const eventsBody = await events.json();
    assert.ok(eventsBody.events.length >= 1);
    assert.equal("metadata" in eventsBody.events[0], false);
    assert.equal("requestId" in eventsBody.events[0], false);
    const storedEvents = await verificationPool.query<{ event_type: string }>(
      "SELECT event_type FROM security_audit_events WHERE user_id = (SELECT id FROM users WHERE email_normalized = $1)",
      ["user@example.com"]
    );
    assert.ok(storedEvents.rows.some(({ event_type }) => event_type === "email_verified"));
    assert.ok(storedEvents.rows.some(({ event_type }) => event_type === "password_reset"));

    const csrf = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: "POST", headers: { cookie: cookieHeader, origin: "https://evil.example" } });
    assert.equal(csrf.status, 403);

    const logout = await post("/api/v1/auth/logout", {}, { cookie: cookieHeader });
    assert.equal(logout.status, 204);
    const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie: cookieHeader } });
    assert.equal(afterLogout.status, 401);
  } finally {
    await closeAuthResources();
    await verificationPool.end();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
