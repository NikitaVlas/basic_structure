export type RateLimitConfig = Readonly<{ backend: "memory" | "valkey"; namespace: string; secret: string; valkeyUrl?: string }>;

export function readRateLimitConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const backend = env.RATE_LIMIT_BACKEND?.trim() || "memory";
  if (backend !== "memory" && backend !== "valkey") throw new Error("RATE_LIMIT_BACKEND must be memory or valkey");
  const namespace = env.RATE_LIMIT_NAMESPACE?.trim() || "app";
  const secret = env.RATE_LIMIT_KEY_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_KEY_SECRET must contain at least 32 characters");
  const valkeyUrl = env.VALKEY_URL?.trim();
  if (backend === "valkey" && !valkeyUrl) throw new Error("VALKEY_URL is required for the valkey rate limit backend");
  return { backend, namespace, secret, ...(valkeyUrl ? { valkeyUrl } : {}) };
}
