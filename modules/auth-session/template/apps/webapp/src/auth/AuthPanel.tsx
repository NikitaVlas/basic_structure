import { useEffect, useState, type FormEvent } from "react";
import { loginRequestSchema, registerRequestSchema, type UserDto } from "@{{PROJECT_NAME}}/contracts";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
type Mode = "login" | "register";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "Request failed");
  return body;
}

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api("/api/v1/auth/me").then((body) => setUser(body.user)).catch(() => undefined).finally(() => setLoading(false)); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setLoading(true);
    const form = new FormData(event.currentTarget);
    const candidate = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
    const parsed = (mode === "register" ? registerRequestSchema : loginRequestSchema).safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Invalid input"); setLoading(false); return; }
    try {
      const body = await api(`/api/v1/auth/${mode}`, { method: "POST", body: JSON.stringify(parsed.data) });
      setUser(body.user);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Request failed"); }
    finally { setLoading(false); }
  }

  async function logout() {
    setLoading(true); setError(null);
    try { await api("/api/v1/auth/logout", { method: "POST", body: "{}" }); setUser(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Request failed"); }
    finally { setLoading(false); }
  }

  if (loading && !user) return <p role="status">Loading account…</p>;
  if (user) return <section aria-labelledby="account-title"><h2 id="account-title">Account</h2><p>{user.email}</p><button onClick={logout} disabled={loading}>Sign out</button>{error && <p role="alert">{error}</p>}</section>;
  return <section aria-labelledby="auth-title"><h2 id="auth-title">{mode === "login" ? "Sign in" : "Create account"}</h2><form onSubmit={submit} noValidate><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : 1} maxLength={128} required /></label><button disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form><button className="link-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>{mode === "login" ? "Create an account" : "Use an existing account"}</button>{error && <p role="alert">{error}</p>}</section>;
}
