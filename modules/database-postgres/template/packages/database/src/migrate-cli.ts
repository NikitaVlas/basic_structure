import { createDatabasePool } from "./pool.js";
import { runMigrations } from "./migrate.js";

const pool = createDatabasePool();
try {
  await runMigrations(pool);
  console.log("Database migrations applied.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database migration failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
