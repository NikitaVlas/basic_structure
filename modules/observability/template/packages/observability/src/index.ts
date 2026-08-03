const REDACTED_KEYS = new Set(["authorization", "cookie", "password", "secret", "token"]);
export function redact(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value]));
}
export function log(level: "debug" | "info" | "warn" | "error", message: string, fields = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...redact(fields) }));
}
