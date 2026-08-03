export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly limit = 5, private readonly windowMs = 60_000) {}

  consume(key: string, now = Date.now()) {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    current.count += 1;
    return current.count <= this.limit
      ? { allowed: true, retryAfterSeconds: 0 }
      : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  clear() { this.entries.clear(); }
}
