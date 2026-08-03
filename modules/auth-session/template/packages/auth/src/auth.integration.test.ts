import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createDatabasePool, runMigrations } from "@{{PROJECT_NAME}}/database";
import { closeAuthResources, handleAuthRequest } from "./index.js";

const enabled = Boolean(process.env.TEST_DATABASE_URL);

test("integration: registration, session, generic login failure, CSRF, and logout", { skip: !enabled }, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.APP_ORIGIN = "http://localhost:5173";
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
    assert.equal("passwordHash" in meBody.user, false);

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
