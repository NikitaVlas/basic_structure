import { useEffect, useState, type FormEvent } from "react";
import {
  emailRequestSchema,
  loginRequestSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  type SecurityEventDto,
  type SessionDto,
  type UserDto
} from "@{{PROJECT_NAME}}/contracts";
import "./AuthPanel.css";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
type Mode = "login" | "register" | "forgot" | "reset";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers }
  });
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "Request failed");
  return body;
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : "Request failed";
}

export function AuthPanel() {
  const initialMode: Mode = window.location.pathname.endsWith("/reset-password") ? "reset" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [user, setUser] = useState<UserDto | null>(null);
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [events, setEvents] = useState<SecurityEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    const verify = window.location.pathname.endsWith("/verify-email") && token
      ? api("/api/v1/auth/email/confirm", { method: "POST", body: JSON.stringify({ token }) })
          .then(() => setNotice("Email verified. You can continue to your account."))
          .catch((caught) => setError(errorMessage(caught)))
      : Promise.resolve();
    verify.then(() => api("/api/v1/auth/me"))
      .then((body) => setUser(body.user))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { setSessions([]); setEvents([]); return; }
    Promise.all([api("/api/v1/auth/sessions"), api("/api/v1/auth/security-events")])
      .then(([sessionBody, eventBody]) => { setSessions(sessionBody.sessions); setEvents(eventBody.events); })
      .catch((caught) => setError(errorMessage(caught)));
  }, [user]);

  function switchMode(next: Mode) {
    setMode(next); setError(null); setNotice(null);
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null); setLoading(true);
    const form = new FormData(event.currentTarget);
    const candidate = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
    const parsed = (mode === "register" ? registerRequestSchema : loginRequestSchema).safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Invalid input"); setLoading(false); return; }
    try {
      const body = await api(`/api/v1/auth/${mode}`, { method: "POST", body: JSON.stringify(parsed.data) });
      setUser(body.user);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  async function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null); setLoading(true);
    const parsed = emailRequestSchema.safeParse({ email: String(new FormData(event.currentTarget).get("email") ?? "") });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Invalid email"); setLoading(false); return; }
    try {
      const body = await api("/api/v1/auth/password/forgot", { method: "POST", body: JSON.stringify(parsed.data) });
      setNotice(body.message);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null); setLoading(true);
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    const parsed = passwordResetRequestSchema.safeParse({ token, password: String(new FormData(event.currentTarget).get("password") ?? "") });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Invalid reset request"); setLoading(false); return; }
    try {
      await api("/api/v1/auth/password/reset", { method: "POST", body: JSON.stringify(parsed.data) });
      switchMode("login"); setNotice("Password changed. Sign in with your new password.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  async function resendVerification() {
    setLoading(true); setError(null);
    try { const body = await api("/api/v1/auth/email/request", { method: "POST", body: "{}" }); setNotice(body.message); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  async function revokeSession(session: SessionDto) {
    setLoading(true); setError(null);
    try {
      await api(`/api/v1/auth/sessions/${session.id}`, { method: "DELETE" });
      if (session.current) setUser(null);
      else setSessions((current) => current.filter(({ id }) => id !== session.id));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  async function logout() {
    setLoading(true); setError(null);
    try { await api("/api/v1/auth/logout", { method: "POST", body: "{}" }); setUser(null); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  if (loading && !user) return <p role="status">Loading account…</p>;

  if (user) return (
    <section className="account-panel" aria-labelledby="account-title">
      <div className="account-heading"><div><h2 id="account-title">Account</h2><p>{user.email}</p></div><button className="secondary-button" onClick={logout} disabled={loading}>Sign out</button></div>
      {!user.emailVerified && <div className="notice"><p>Your email is not verified.</p><button onClick={resendVerification} disabled={loading}>Resend verification</button></div>}
      <h3>Active sessions</h3>
      {sessions.length === 0 ? <p role="status">No active sessions found.</p> : <ul className="security-list">{sessions.map((session) => <li key={session.id}><div><strong>{session.clientLabel}</strong>{session.current && <span className="badge">Current</span>}<small>Last active {new Date(session.lastSeenAt).toLocaleString()}</small></div><button className="danger-button" onClick={() => revokeSession(session)} disabled={loading}>Revoke</button></li>)}</ul>}
      <h3>Recent security activity</h3>
      {events.length === 0 ? <p>No security events yet.</p> : <ul className="event-list">{events.map((event) => <li key={event.id}><span>{event.eventType.replaceAll("_", " ")}</span><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time></li>)}</ul>}
      {notice && <p className="success" role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    </section>
  );

  if (mode === "forgot") return <section aria-labelledby="auth-title"><h2 id="auth-title">Reset password</h2><p>Enter your email. The response is the same whether an account exists or not.</p><form onSubmit={submitForgot} noValidate><label>Email<input name="email" type="email" autoComplete="email" required /></label><button disabled={loading}>Send reset link</button></form><button className="link-button" onClick={() => switchMode("login")}>Back to sign in</button>{notice && <p className="success" role="status">{notice}</p>}{error && <p role="alert">{error}</p>}</section>;
  if (mode === "reset") return <section aria-labelledby="auth-title"><h2 id="auth-title">Choose a new password</h2><form onSubmit={submitReset} noValidate><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><button disabled={loading}>Change password</button></form><button className="link-button" onClick={() => switchMode("login")}>Back to sign in</button>{error && <p role="alert">{error}</p>}</section>;

  return <section aria-labelledby="auth-title"><h2 id="auth-title">{mode === "login" ? "Sign in" : "Create account"}</h2><form onSubmit={submitCredentials} noValidate><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : 1} maxLength={128} required /></label><button disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form><div className="auth-actions"><button className="link-button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "Use an existing account"}</button>{mode === "login" && <button className="link-button" onClick={() => switchMode("forgot")}>Forgot password?</button>}</div>{notice && <p className="success" role="status">{notice}</p>}{error && <p role="alert">{error}</p>}</section>;
}
