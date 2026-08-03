export type EmailConfig =
  | Readonly<{ transport: "console"; from: string }>
  | Readonly<{
      transport: "smtp";
      from: string;
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      password?: string;
    }>;

function required(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function readEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const transport = env.EMAIL_TRANSPORT?.trim() || "console";
  const from = required(env, "EMAIL_FROM");
  if (transport === "console") return { transport, from };
  if (transport !== "smtp") throw new Error("EMAIL_TRANSPORT must be console or smtp");

  const port = Number(env.EMAIL_SMTP_PORT || "1025");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("EMAIL_SMTP_PORT must be an integer between 1 and 65535");
  }
  const secureValue = env.EMAIL_SMTP_SECURE?.trim() || "false";
  if (secureValue !== "true" && secureValue !== "false") {
    throw new Error("EMAIL_SMTP_SECURE must be true or false");
  }
  const user = env.EMAIL_SMTP_USER?.trim() || undefined;
  const password = env.EMAIL_SMTP_PASSWORD;
  if ((user && !password) || (!user && password)) {
    throw new Error("EMAIL_SMTP_USER and EMAIL_SMTP_PASSWORD must be set together");
  }

  return {
    transport,
    from,
    host: required(env, "EMAIL_SMTP_HOST"),
    port,
    secure: secureValue === "true",
    ...(user && password ? { user, password } : {})
  };
}
