import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken() { return randomBytes(32).toString("base64url"); }
export function digestOpaqueToken(token: string) { return createHash("sha256").update(token, "utf8").digest("hex"); }
export const createSessionToken = createOpaqueToken;
export const digestSessionToken = digestOpaqueToken;
