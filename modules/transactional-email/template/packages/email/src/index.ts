import { readEmailConfig } from "./config.js";
import { ConsoleEmailTransport } from "./console.js";
import { SmtpEmailTransport } from "./smtp.js";

export * from "./config.js";
export * from "./console.js";
export * from "./smtp.js";
export * from "./templates.js";
export * from "./types.js";
export * from "./outbox-crypto.js";
export * from "./worker-config.js";
export * from "./worker.js";

export function createEmailTransport(env: NodeJS.ProcessEnv = process.env) {
  const config = readEmailConfig(env);
  return config.transport === "console"
    ? new ConsoleEmailTransport()
    : new SmtpEmailTransport(config);
}
