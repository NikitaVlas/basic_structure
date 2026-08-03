export type RateLimitPolicy = Readonly<{ limit: number; windowMs: number }>;
export type RateLimitDecision = Readonly<{ allowed: boolean; retryAfterSeconds: number }>;

export interface RateLimiter {
  consume(scope: string, subject: string, policy: RateLimitPolicy, now?: number): Promise<RateLimitDecision>;
  ready(): Promise<boolean>;
  close(): Promise<void>;
}

export class RateLimitBackendUnavailableError extends Error {
  constructor() { super("Rate limit backend is unavailable"); }
}
