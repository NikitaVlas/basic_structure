import { randomUUID } from "node:crypto";
import type { EmailOutboxRecord, EmailOutboxRepository } from "@{{PROJECT_NAME}}/database";
import { createLogger, createMetricsRegistry } from "@{{PROJECT_NAME}}/observability";
import type { EmailTransport } from "./types.js";
import { openEmail } from "./outbox-crypto.js";
import { retryDelayMs, type EmailWorkerConfig } from "./worker-config.js";

function errorCategory(error: unknown) {
  return error instanceof Error && error.message === "INVALID_OUTBOX_PAYLOAD" ? "invalid_payload" : "delivery_failed";
}

const workerLogger = createLogger({ service: "email-worker", environment: process.env.NODE_ENV ?? "development" });
const workerMetrics = createMetricsRegistry();
const jobsProcessed = workerMetrics.counter("email_outbox_jobs_total", "Email outbox jobs processed");
const pollFailures = workerMetrics.counter("email_outbox_poll_failures_total", "Email outbox poll failures");
const workerRunning = workerMetrics.gauge("email_outbox_worker_running", "Whether the email outbox worker loop is running");
export function renderEmailWorkerMetrics() { return workerMetrics.render(); }

export class EmailOutboxWorker {
  readonly #leaseOwner = randomUUID();

  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly transport: EmailTransport,
    private readonly config: EmailWorkerConfig,
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async #deliver(job: EmailOutboxRecord, now: Date) {
    const jobLogger = workerLogger.child({ jobId: job.id });
    try {
      const message = openEmail({ ciphertext: job.message_ciphertext, nonce: job.message_nonce, authTag: job.message_auth_tag }, this.env);
      if (message.template !== job.template) throw new Error("INVALID_OUTBOX_PAYLOAD");
      await this.transport.send(message);
      const acknowledged = await this.outbox.markDelivered(job.id, this.#leaseOwner, now);
      jobsProcessed.add(1, { outcome: acknowledged ? "delivered" : "stale", template: job.template });
      jobLogger.log(acknowledged ? "info" : "warn", acknowledged ? "email_outbox_delivered" : "email_outbox_stale_ack", { template: job.template, attempts: job.attempts });
    } catch (error) {
      const category = errorCategory(error);
      const effectiveAttempts = category === "invalid_payload" ? this.config.maxAttempts : job.attempts;
      const retryAt = new Date(now.getTime() + retryDelayMs(effectiveAttempts, this.config));
      const acknowledged = await this.outbox.markFailed({ id: job.id, leaseOwner: this.#leaseOwner, attempts: effectiveAttempts, maxAttempts: this.config.maxAttempts, retryAt, errorCategory: category, now });
      jobsProcessed.add(1, { outcome: acknowledged ? category : "stale", template: job.template });
      jobLogger.log("warn", acknowledged ? "email_outbox_delivery_failed" : "email_outbox_stale_failure", { template: job.template, attempts: job.attempts, category });
    }
  }

  async runOnce(now = new Date()) {
    const jobs = await this.outbox.claim({ leaseOwner: this.#leaseOwner, limit: this.config.batchSize, now, leaseMs: this.config.leaseMs });
    for (const job of jobs) await this.#deliver(job, new Date());
    return jobs.length;
  }

  async run(signal: AbortSignal) {
    workerRunning.set(1);
    workerLogger.log("info", "email_outbox_worker_started");
    while (!signal.aborted) {
      try { if (await this.runOnce() > 0) continue; }
      catch (error) { pollFailures.add(); workerLogger.log("error", "email_outbox_poll_failed", { error }); }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, this.config.pollMs);
        signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    workerRunning.set(0);
    workerLogger.log("info", "email_outbox_worker_stopped");
  }
}
