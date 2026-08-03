import { readRateLimitConfig } from "./config.js";
import { MemoryRateLimiter } from "./memory.js";
import { ValkeyRateLimiter } from "./valkey.js";

export * from "./config.js";
export * from "./key.js";
export * from "./memory.js";
export * from "./types.js";
export * from "./valkey.js";

export function createRateLimiter(env: NodeJS.ProcessEnv = process.env) {
  const config = readRateLimitConfig(env);
  return config.backend === "memory"
    ? new MemoryRateLimiter(config.namespace, config.secret)
    : new ValkeyRateLimiter(config.valkeyUrl!, config.namespace, config.secret);
}
