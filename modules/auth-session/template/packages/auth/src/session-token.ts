import { createHash, randomBytes } from "node:crypto";

export function createSessionToken() { return randomBytes(32).toString("base64url"); }
export function digestSessionToken(token: string) { return createHash("sha256").update(token, "utf8").digest("hex"); }
