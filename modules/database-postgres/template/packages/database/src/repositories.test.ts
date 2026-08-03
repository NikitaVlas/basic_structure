import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult, QueryResultRow } from "pg";
import { SessionRepository } from "./sessions.js";
import type { Queryable } from "./types.js";
import { UserRepository } from "./users.js";

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
