import { rateLimitKey, validatePolicy } from "./key.js";
import type { RateLimiter, RateLimitPolicy } from "./types.js";

export class MemoryRateLimiter implements RateLimiter {
  readonly #entries = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly namespace: string, private readonly secret: string) {}

  async consume(scope: string, subject: string, policy: RateLimitPolicy, now = Date.now()) {
    validatePolicy(policy);
    const key = rateLimitKey(this.namespace, scope, subject, this.secret);
    const current = this.#entries.get(key);
    if (!current || current.resetAt <= now) {
      this.#entries.set(key, { count: 1, resetAt: now + policy.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    current.count += 1;
    return current.count <= policy.limit
      ? { allowed: true, retryAfterSeconds: 0 }
      : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  async ready() { return true; }
  async close() { this.#entries.clear(); }
}
