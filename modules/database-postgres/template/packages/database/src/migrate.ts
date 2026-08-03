import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

const MIGRATION_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;
const LOCK_ID = 724_031_908;

async function ensureHistory(client: PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

export async function runMigrations(pool: Pool, directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations")) {
  const names = (await readdir(directory)).filter((name) => MIGRATION_PATTERN.test(name)).sort();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await ensureHistory(client);
    const applied = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const completed = new Set(applied.rows.map(({ name }) => name));
    for (const name of names) {
      if (completed.has(name)) continue;
      const sql = await readFile(path.join(directory, name), "utf8");
      await client.query("BEGIN");
      try {
        // Migration SQL is trusted, version-controlled input; application values never enter it.
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration failed: ${name}`, { cause: error });
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
