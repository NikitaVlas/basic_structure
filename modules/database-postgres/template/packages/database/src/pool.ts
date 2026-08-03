import { Pool, type PoolConfig } from "pg";
import { requireDatabaseUrl } from "./config.js";

export function createDatabasePool(overrides: PoolConfig = {}) {
  return new Pool({
    connectionString: requireDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...overrides
  });
}
