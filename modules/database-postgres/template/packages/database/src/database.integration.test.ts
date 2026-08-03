import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { runMigrations } from "./migrate.js";

test("integration: migrations create auth tables idempotently", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
  try {
    await runMigrations(pool);
    await runMigrations(pool);
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [["schema_migrations", "sessions", "users"]]
    );
    assert.deepEqual(result.rows.map(({ table_name }) => table_name), ["schema_migrations", "sessions", "users"]);
  } finally { await pool.end(); }
});
