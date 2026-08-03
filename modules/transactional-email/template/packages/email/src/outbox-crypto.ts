import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { EmailTemplate, TransactionalEmail } from "./types.js";

export type SealedEmail = Readonly<{ ciphertext: string; nonce: string; authTag: string }>;

function encryptionKey(env: NodeJS.ProcessEnv = process.env) {
  const encoded = env.EMAIL_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("EMAIL_OUTBOX_ENCRYPTION_KEY is required");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new Error("EMAIL_OUTBOX_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function sealEmail(message: TransactionalEmail, env?: NodeJS.ProcessEnv): SealedEmail {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(message), "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

function isTemplate(value: unknown): value is EmailTemplate {
  return value === "verify-email" || value === "reset-password";
}

function parseEmail(value: unknown): TransactionalEmail {
  if (!value || typeof value !== "object") throw new Error("INVALID_OUTBOX_PAYLOAD");
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort().join(",");
  if (keys !== "html,subject,template,text,to" || typeof candidate.to !== "string" || candidate.to.length > 320 ||
      !isTemplate(candidate.template) || typeof candidate.subject !== "string" || candidate.subject.length > 200 ||
      typeof candidate.text !== "string" || candidate.text.length > 100_000 ||
      typeof candidate.html !== "string" || candidate.html.length > 100_000) {
    throw new Error("INVALID_OUTBOX_PAYLOAD");
  }
  return candidate as unknown as TransactionalEmail;
}

export function openEmail(message: SealedEmail, env?: NodeJS.ProcessEnv) {
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), Buffer.from(message.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(message.authTag, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(message.ciphertext, "base64")), decipher.final()]).toString("utf8");
    return parseEmail(JSON.parse(plaintext));
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_OUTBOX_PAYLOAD") throw error;
    throw new Error("INVALID_OUTBOX_PAYLOAD");
  }
}
