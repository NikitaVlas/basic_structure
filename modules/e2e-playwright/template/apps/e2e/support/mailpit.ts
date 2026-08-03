import { expect } from "@playwright/test";

const MAILPIT_API = "http://127.0.0.1:8025/api/v1";

function collectMessageIds(value: unknown, result = new Set<string>()) {
  if (Array.isArray(value)) for (const item of value) collectMessageIds(item, result);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if ((key === "ID" || key === "Id" || key === "id") && (typeof child === "string" || typeof child === "number")) result.add(String(child));
      else collectMessageIds(child, result);
    }
  }
  return [...result];
}

export async function waitForApplicationLink(recipient: string, pathname: string) {
  let found: string | undefined;
  await expect.poll(async () => {
    const list = await fetch(`${MAILPIT_API}/messages?limit=50`);
    if (!list.ok) return false;
    const ids = collectMessageIds(await list.json());
    for (const id of ids) {
      const response = await fetch(`${MAILPIT_API}/message/${encodeURIComponent(id)}`);
      if (!response.ok) continue;
      const serialized = JSON.stringify(await response.json());
      if (!serialized.includes(recipient) || !serialized.includes(pathname)) continue;
      const normalized = serialized.replaceAll("\\u0026", "&").replaceAll("\\/", "/");
      const match = normalized.match(new RegExp(`http://127\\.0\\.0\\.1:35173${pathname.replace("/", "\\/")}\\?token=[A-Za-z0-9_%.-]+`));
      if (match) { found = match[0]; return true; }
    }
    return false;
  }, { timeout: 15_000, intervals: [200, 300, 500] }).toBe(true);
  if (!found) throw new Error(`Mailpit did not expose a ${pathname} link`);
  return found;
}
