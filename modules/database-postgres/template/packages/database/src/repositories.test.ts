import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult, QueryResultRow } from "pg";
import { SessionRepository } from "./sessions.js";
import type { Queryable } from "./types.js";
import { UserRepository } from "./users.js";
import { AccountTokenRepository } from "./account-tokens.js";
import { SecurityAuditRepository } from "./security-audit.js";

function recordingDatabase(rows: QueryResultRow[] = []) {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  const database: Queryable = {
    async query<T extends QueryResultRow>(text: string, values?: readonly unknown[]) {
      calls.push(values === undefined ? { text } : { text, values });
      return { rows: rows as T[], rowCount: rows.length, command: "SELECT", oid: 0, fields: [] } as QueryResult<T>;
    }
  };
  return { calls, database };
}

test("user lookup keeps untrusted email out of SQL text", async () => {
  const attack = "x@example.com' OR true --";
  const { calls, database } = recordingDatabase();
  await new UserRepository(database).findByNormalizedEmail(attack);
  assert.match(calls[0]!.text, /email_normalized = \$1/);
  assert.ok(!calls[0]!.text.includes(attack));
  assert.deepEqual(calls[0]!.values, [attack]);
});

test("session deletion uses a digest parameter", async () => {
  const digest = "a".repeat(64);
  const { calls, database } = recordingDatabase();
  await new SessionRepository(database).deleteByDigest(digest);
  assert.match(calls[0]!.text, /token_digest = \$1/);
  assert.deepEqual(calls[0]!.values, [digest]);
});

test("password reset consumes a digest and changes password in one statement", async () => {
  const digest = "b".repeat(64);
  const passwordHash = "scrypt$replacement";
  const { calls, database } = recordingDatabase();
  await new AccountTokenRepository(database).consumePasswordReset(digest, passwordHash);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /DELETE FROM account_tokens/);
  assert.match(calls[0]!.text, /UPDATE users SET password_hash = \$3/);
  assert.match(calls[0]!.text, /DELETE FROM sessions/);
  assert.equal(calls[0]!.values?.[0], digest);
  assert.equal(calls[0]!.values?.[2], passwordHash);
});

test("session revocation enforces ownership in SQL", async () => {
  const { calls, database } = recordingDatabase();
  await new SessionRepository(database).deleteOwnedById("owner-id", "session-id");
  assert.match(calls[0]!.text, /id = \$1 AND user_id = \$2/);
  assert.deepEqual(calls[0]!.values, ["session-id", "owner-id"]);
});

test("audit events use parameters and clamp list limits", async () => {
  const { calls, database } = recordingDatabase([{
    id: "event-id", user_id: "user-id", session_id: null, event_type: "password_reset",
    outcome: "success", request_id: "request-id", metadata: {}, occurred_at: new Date()
  }]);
  const repository = new SecurityAuditRepository(database);
  await repository.record({ userId: "user-id", eventType: "password_reset", outcome: "success", requestId: "request-id" });
  await repository.listRecentForUser("user-id", 10_000);
  assert.match(calls[0]!.text, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)/);
  assert.deepEqual(calls[1]!.values, ["user-id", 100]);
});
