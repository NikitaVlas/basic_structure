import { readEmailConfig } from "./config.js";
import { ConsoleEmailTransport } from "./console.js";
import { SmtpEmailTransport } from "./smtp.js";

export * from "./config.js";
export * from "./console.js";
export * from "./smtp.js";
export * from "./templates.js";
export * from "./types.js";

export function createEmailTransport(env: NodeJS.ProcessEnv = process.env) {
  const config = readEmailConfig(env);
  return config.transport === "console"
    ? new ConsoleEmailTransport()
    : new SmtpEmailTransport(config);
}
