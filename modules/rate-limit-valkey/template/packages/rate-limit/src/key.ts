import { createHmac } from "node:crypto";

const SAFE_PART = /^[a-z0-9][a-z0-9:_-]{0,63}$/;

export function rateLimitKey(namespace: string, scope: string, subject: string, secret: string) {
  if (!SAFE_PART.test(namespace)) throw new Error("RATE_LIMIT_NAMESPACE contains invalid characters");
  if (!SAFE_PART.test(scope)) throw new Error("Rate limit scope contains invalid characters");
  if (secret.length < 32) throw new Error("RATE_LIMIT_KEY_SECRET must contain at least 32 characters");
  const pseudonym = createHmac("sha256", secret).update(subject, "utf8").digest("hex");
  return `${namespace}:rate-limit:${scope}:${pseudonym}`;
}

export function validatePolicy(policy: { limit: number; windowMs: number }) {
  if (!Number.isSafeInteger(policy.limit) || policy.limit < 1 || policy.limit > 100_000) throw new Error("Rate limit must be an integer from 1 to 100000");
  if (!Number.isSafeInteger(policy.windowMs) || policy.windowMs < 1000 || policy.windowMs > 24 * 60 * 60 * 1000) throw new Error("Rate limit window must be from 1000 to 86400000 milliseconds");
}
