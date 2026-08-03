import type { IncomingMessage } from "node:http";

export function sessionCookieName(production = process.env.NODE_ENV === "production") { return production ? "__Host-session" : "session"; }

export function readSessionCookie(request: IncomingMessage, production = process.env.NODE_ENV === "production") {
  const name = sessionCookieName(production);
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function createSessionCookie(token: string, maxAgeSeconds: number, production = process.env.NODE_ENV === "production") {
  const secure = production ? "; Secure" : "";
  return `${sessionCookieName(production)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie(production = process.env.NODE_ENV === "production") {
  return createSessionCookie("", 0, production);
}
