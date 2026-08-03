import type { TransactionalEmail } from "./types.js";

function applicationUrl(path: string, token: string, env: NodeJS.ProcessEnv = process.env) {
  const base = env.PUBLIC_APP_URL?.trim();
  if (!base) throw new Error("PUBLIC_APP_URL is required");
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]!);
}

export function verificationEmail(to: string, token: string, env?: NodeJS.ProcessEnv): TransactionalEmail {
  const url = applicationUrl("verify-email", token, env);
  return {
    to,
    template: "verify-email",
    subject: "Verify your email address",
    text: `Verify your email address: ${url}\n\nThis link expires in 24 hours.`,
    html: `<p>Verify your email address:</p><p><a href="${escapeHtml(url)}">Verify email</a></p><p>This link expires in 24 hours.</p>`
  };
}

export function passwordResetEmail(to: string, token: string, env?: NodeJS.ProcessEnv): TransactionalEmail {
  const url = applicationUrl("reset-password", token, env);
  return {
    to,
    template: "reset-password",
    subject: "Reset your password",
    text: `Reset your password: ${url}\n\nThis link expires in 30 minutes. If you did not request it, ignore this email.`,
    html: `<p>Reset your password:</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, ignore this email.</p>`
  };
}
