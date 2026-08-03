import { EmailOutboxRepository, createDatabasePool } from "@{{PROJECT_NAME}}/database";
import { createEmailTransport } from "./index.js";
import { EmailOutboxWorker } from "./worker.js";
import { readEmailWorkerConfig } from "./worker-config.js";

const pool = createDatabasePool();
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());

try {
  const worker = new EmailOutboxWorker(new EmailOutboxRepository(pool), createEmailTransport(), readEmailWorkerConfig());
  await worker.run(controller.signal);
} finally {
  await pool.end();
}
