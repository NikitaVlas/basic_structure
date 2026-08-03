export type EmailWorkerConfig = Readonly<{
  pollMs: number; batchSize: number; leaseMs: number; maxAttempts: number; baseRetryMs: number; maxRetryMs: number;
}>;

function integer(env: NodeJS.ProcessEnv, key: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(env[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

export function readEmailWorkerConfig(env: NodeJS.ProcessEnv = process.env): EmailWorkerConfig {
  return {
    pollMs: integer(env, "EMAIL_WORKER_POLL_MS", 1000, 100, 60_000),
    batchSize: integer(env, "EMAIL_WORKER_BATCH_SIZE", 10, 1, 100),
    leaseMs: integer(env, "EMAIL_WORKER_LEASE_MS", 30_000, 5_000, 15 * 60_000),
    maxAttempts: integer(env, "EMAIL_WORKER_MAX_ATTEMPTS", 5, 1, 20),
    baseRetryMs: integer(env, "EMAIL_WORKER_BASE_RETRY_MS", 5000, 100, 60 * 60_000),
    maxRetryMs: 60 * 60_000
  };
}

export function retryDelayMs(attempts: number, config: Pick<EmailWorkerConfig, "baseRetryMs" | "maxRetryMs">) {
  return Math.min(config.maxRetryMs, config.baseRetryMs * (2 ** Math.max(0, attempts - 1)));
}
