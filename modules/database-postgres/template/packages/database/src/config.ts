export function requireDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required");
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("DATABASE_URL must be a valid URL"); }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
  }
  if (!parsed.hostname || !parsed.pathname.slice(1)) throw new Error("DATABASE_URL must include a host and database name");
  return value;
}
