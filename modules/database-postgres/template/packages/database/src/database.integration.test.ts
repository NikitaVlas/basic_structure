import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { runMigrations } from "./migrate.js";
import { AccountTokenRepository } from "./account-tokens.js";
import { EmailOutboxRepository } from "./email-outbox.js";
import { withDatabaseTransaction } from "./transaction.js";

test("integration: migrations create auth tables idempotently", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  try {
    await runMigrations(pool);
    await runMigrations(pool);
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [["account_tokens", "schema_migrations", "security_audit_events", "sessions", "transactional_email_outbox", "users"]]
    );
    assert.deepEqual(result.rows.map(({ table_name }) => table_name), ["account_tokens", "schema_migrations", "security_audit_events", "sessions", "transactional_email_outbox", "users"]);

    await pool.query("TRUNCATE transactional_email_outbox, account_tokens, users CASCADE");
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (email_normalized, email_display, password_hash)
       VALUES ('outbox@example.test', 'outbox@example.test', $1) RETURNING id`,
      ["x".repeat(64)]
    );
    const userId = user.rows[0]!.id;
    await assert.rejects(() => withDatabaseTransaction(pool, async (client) => {
      await new AccountTokenRepository(client).issue({ userId, purpose: "verify_email", tokenDigest: "a".repeat(64), expiresAt: new Date(Date.now() + 60_000) });
      await new EmailOutboxRepository(client).enqueue({ template: "verify-email", message: { ciphertext: "encrypted", nonce: "nonce-value-123456", authTag: "auth-tag-value-1234" } });
      throw new Error("force rollback");
    }), /force rollback/);
    const rolledBack = await pool.query<{ tokens: string; jobs: string }>(
      `SELECT (SELECT count(*)::text FROM account_tokens) AS tokens,
              (SELECT count(*)::text FROM transactional_email_outbox) AS jobs`
    );
    assert.deepEqual(rolledBack.rows[0], { tokens: "0", jobs: "0" });

    const outbox = new EmailOutboxRepository(pool);
    await outbox.enqueue({ template: "verify-email", message: { ciphertext: "encrypted", nonce: "nonce-value-123456", authTag: "auth-tag-value-1234" } });
    const now = new Date();
    const [first, second] = await Promise.all([
      outbox.claim({ leaseOwner: "018f22ec-8dc2-7d20-8000-000000000001", limit: 1, now, leaseMs: 5000 }),
      outbox.claim({ leaseOwner: "018f22ec-8dc2-7d20-8000-000000000002", limit: 1, now, leaseMs: 5000 })
    ]);
    assert.equal(first.length + second.length, 1);
    const claimed = first[0] ?? second[0]!;
    const originalOwner = claimed.lease_owner!;
    const replacementOwner = "018f22ec-8dc2-7d20-8000-000000000003";
    const reclaimed = await outbox.claim({ leaseOwner: replacementOwner, limit: 1, now: new Date(now.getTime() + 5001), leaseMs: 5000 });
    assert.equal(reclaimed[0]?.id, claimed.id);
    assert.equal(await outbox.markDelivered(claimed.id, originalOwner), false);
    assert.equal(await outbox.markDelivered(claimed.id, replacementOwner), true);
  } finally { await pool.end(); }
});
