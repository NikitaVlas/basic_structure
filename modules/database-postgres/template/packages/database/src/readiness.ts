import type { Pool } from "pg";
import { createDatabasePool } from "./pool.js";

let readinessPool: Pool | undefined;
export async function checkDatabaseReadiness() {
  readinessPool ??= createDatabasePool({ max: 2, connectionTimeoutMillis: 2_000 });
  await readinessPool.query("SELECT 1");
}

export async function closeDatabaseReadiness() {
  const pool = readinessPool;
  readinessPool = undefined;
  if (pool) await pool.end();
}
