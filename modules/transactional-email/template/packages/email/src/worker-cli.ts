import { createServer } from "node:http";
import { EmailOutboxRepository, createDatabasePool } from "@{{PROJECT_NAME}}/database";
import { createLogger, requestIdFrom } from "@{{PROJECT_NAME}}/observability";
import { createEmailTransport } from "./index.js";
import { EmailOutboxWorker, renderEmailWorkerMetrics } from "./worker.js";
import { readEmailWorkerConfig } from "./worker-config.js";

const pool = createDatabasePool();
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());
const logger = createLogger({ service: "email-worker", environment: process.env.NODE_ENV ?? "development" });
const healthPort = Number.parseInt(process.env.EMAIL_WORKER_HEALTH_PORT ?? "3001", 10);
if (!Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65_535) throw new Error("EMAIL_WORKER_HEALTH_PORT must be a valid port");
const healthServer = createServer(async (request, response) => {
  const requestId = requestIdFrom(request.headers["x-request-id"]);
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (request.method === "GET" && pathname === "/health") { response.setHeader("content-type", "application/json"); response.end('{"status":"ok"}'); return; }
  if (request.method === "GET" && pathname === "/ready") {
    try { await pool.query("SELECT 1"); response.setHeader("content-type", "application/json"); response.end('{"status":"ok","database":"connected"}'); }
    catch { response.setHeader("content-type", "application/json"); response.writeHead(503).end('{"status":"degraded","database":"unavailable"}'); }
    return;
  }
  if (request.method === "GET" && pathname === "/metrics") { response.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8"); response.end(renderEmailWorkerMetrics()); return; }
  response.setHeader("content-type", "application/json"); response.writeHead(404).end('{"error":{"code":"NOT_FOUND","message":"Route not found"}}');
});

try {
  await new Promise<void>((resolve, reject) => { healthServer.once("error", reject); healthServer.listen(healthPort, "127.0.0.1", resolve); });
  logger.log("info", "email_worker_health_server_started", { port: healthPort });
  const worker = new EmailOutboxWorker(new EmailOutboxRepository(pool), createEmailTransport(), readEmailWorkerConfig());
  await worker.run(controller.signal);
} finally {
  await new Promise<void>((resolve) => healthServer.close(() => resolve()));
  await pool.end();
  logger.log("info", "email_worker_shutdown_complete");
}
