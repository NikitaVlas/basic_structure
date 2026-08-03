import { createClient, type RedisClientType } from "redis";
import { log } from "@{{PROJECT_NAME}}/observability";
import { rateLimitKey, validatePolicy } from "./key.js";
import { RateLimitBackendUnavailableError, type RateLimiter, type RateLimitPolicy } from "./types.js";

const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}`;

export class ValkeyRateLimiter implements RateLimiter {
  readonly #client: RedisClientType;
  #connecting: Promise<unknown> | undefined;

  constructor(url: string, private readonly namespace: string, private readonly secret: string) {
    this.#client = createClient({ url, socket: { connectTimeout: 2000, reconnectStrategy: false } });
    this.#client.on("error", () => log("warn", "rate_limit_backend_error", { backend: "valkey" }));
  }

  async #connect() {
    if (this.#client.isReady) return;
    this.#connecting ??= this.#client.connect().finally(() => { this.#connecting = undefined; });
    await this.#connecting;
  }

  async consume(scope: string, subject: string, policy: RateLimitPolicy) {
    validatePolicy(policy);
    const key = rateLimitKey(this.namespace, scope, subject, this.secret);
    try {
      await this.#connect();
      const result = await this.#client.eval(FIXED_WINDOW_SCRIPT, { keys: [key], arguments: [String(policy.windowMs)] });
      if (!Array.isArray(result) || result.length !== 2) throw new Error("Unexpected rate limit response");
      const count = Number(result[0]);
      const ttl = Math.max(1, Number(result[1]));
      return count <= policy.limit
        ? { allowed: true, retryAfterSeconds: 0 }
        : { allowed: false, retryAfterSeconds: Math.min(Math.ceil(policy.windowMs / 1000), Math.max(1, Math.ceil(ttl / 1000))) };
    } catch {
      throw new RateLimitBackendUnavailableError();
    }
  }

  async ready() {
    try { await this.#connect(); return (await this.#client.ping()) === "PONG"; }
    catch { return false; }
  }

  async close() {
    if (this.#client.isOpen) await this.#client.close();
  }
}
