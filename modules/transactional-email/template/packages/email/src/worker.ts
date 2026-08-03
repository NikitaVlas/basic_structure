import { randomUUID } from "node:crypto";
import type { EmailOutboxRecord, EmailOutboxRepository } from "@{{PROJECT_NAME}}/database";
import { log } from "@{{PROJECT_NAME}}/observability";
import type { EmailTransport } from "./types.js";
import { openEmail } from "./outbox-crypto.js";
import { retryDelayMs, type EmailWorkerConfig } from "./worker-config.js";

function errorCategory(error: unknown) {
  return error instanceof Error && error.message === "INVALID_OUTBOX_PAYLOAD" ? "invalid_payload" : "delivery_failed";
}

export class EmailOutboxWorker {
  readonly #leaseOwner = randomUUID();

  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly transport: EmailTransport,
    private readonly config: EmailWorkerConfig,
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async #deliver(job: EmailOutboxRecord, now: Date) {
    try {
      const message = openEmail({ ciphertext: job.message_ciphertext, nonce: job.message_nonce, authTag: job.message_auth_tag }, this.env);
      if (message.template !== job.template) throw new Error("INVALID_OUTBOX_PAYLOAD");
      await this.transport.send(message);
      const acknowledged = await this.outbox.markDelivered(job.id, this.#leaseOwner, now);
      log(acknowledged ? "info" : "warn", acknowledged ? "email_outbox_delivered" : "email_outbox_stale_ack", { jobId: job.id, template: job.template, attempts: job.attempts });
    } catch (error) {
      const category = errorCategory(error);
      const effectiveAttempts = category === "invalid_payload" ? this.config.maxAttempts : job.attempts;
      const retryAt = new Date(now.getTime() + retryDelayMs(effectiveAttempts, this.config));
      const acknowledged = await this.outbox.markFailed({ id: job.id, leaseOwner: this.#leaseOwner, attempts: effectiveAttempts, maxAttempts: this.config.maxAttempts, retryAt, errorCategory: category, now });
      log("warn", acknowledged ? "email_outbox_delivery_failed" : "email_outbox_stale_failure", { jobId: job.id, template: job.template, attempts: job.attempts, category });
    }
  }

  async runOnce(now = new Date()) {
    const jobs = await this.outbox.claim({ leaseOwner: this.#leaseOwner, limit: this.config.batchSize, now, leaseMs: this.config.leaseMs });
    for (const job of jobs) await this.#deliver(job, new Date());
    return jobs.length;
  }

  async run(signal: AbortSignal) {
    log("info", "email_outbox_worker_started");
    while (!signal.aborted) {
      try { if (await this.runOnce() > 0) continue; }
      catch { log("error", "email_outbox_poll_failed"); }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, this.config.pollMs);
        signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    log("info", "email_outbox_worker_stopped");
  }
}
