import { createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { apiError, emailRequestSchema, loginRequestSchema, passwordResetRequestSchema, registerRequestSchema, tokenRequestSchema, type ApiErrorCode } from "@{{PROJECT_NAME}}/contracts";
import { AccountTokenRepository, createDatabasePool, SecurityAuditRepository, SessionRepository, UserRepository } from "@{{PROJECT_NAME}}/database";
import type { Pool } from "pg";
import { log, requestIdFrom } from "@{{PROJECT_NAME}}/observability";
import { createRateLimiter, RateLimitBackendUnavailableError, type RateLimiter, type RateLimitPolicy } from "@{{PROJECT_NAME}}/rate-limit";
import { clearSessionCookie, createSessionCookie, readSessionCookie } from "./cookies.js";
import { AuthService, EmailConflictError, InvalidAccountTokenError, InvalidCredentialsError } from "./service.js";

const RATE_LIMIT_POLICIES = {
  register: { limit: 5, windowMs: 15 * 60_000 },
  login: { limit: 5, windowMs: 5 * 60_000 },
  "login-account": { limit: 10, windowMs: 15 * 60_000 },
  forgot: { limit: 5, windowMs: 15 * 60_000 },
  "forgot-account": { limit: 5, windowMs: 15 * 60_000 },
  reset: { limit: 5, windowMs: 15 * 60_000 },
  "reset-token": { limit: 5, windowMs: 15 * 60_000 },
  verify: { limit: 3, windowMs: 15 * 60_000 }
} satisfies Record<string, RateLimitPolicy>;

let limiter: RateLimiter | undefined;
let service: AuthService | undefined;
let pool: Pool | undefined;
function getLimiter() { return limiter ??= createRateLimiter(); }
export async function checkAuthRateLimitReadiness() { return getLimiter().ready(); }
function getService() {
  if (!service) {
    const durationDays = Number.parseInt(process.env.SESSION_DURATION_DAYS ?? "7", 10);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) throw new Error("SESSION_DURATION_DAYS must be an integer from 1 to 30");
    pool = createDatabasePool();
    service = new AuthService(
      new UserRepository(pool),
      new SessionRepository(pool),
      new AccountTokenRepository(pool),
      new SecurityAuditRepository(pool),
      pool,
      durationDays * 24 * 60 * 60 * 1000
    );
  }
  return service;
}

export async function closeAuthResources() {
  const activePool = pool;
  const activeLimiter = limiter;
  pool = undefined;
  service = undefined;
  limiter = undefined;
  if (activeLimiter) await activeLimiter.close();
  if (activePool) await activePool.end();
}

function allowedOrigin() { return (process.env.APP_ORIGIN ?? "http://localhost:5173").replace(/\/$/, ""); }
function requestOrigin(request: IncomingMessage) {
  const value = request.headers.origin ?? request.headers.referer;
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}
function hasAllowedOrigin(request: IncomingMessage) { return requestOrigin(request) === allowedOrigin(); }
function sessionClientContext(request: IncomingMessage) {
  const secret = process.env.IP_HASH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("IP_HASH_SECRET must contain at least 32 characters");
  const address = request.socket.remoteAddress ?? "unknown";
  const clientLabel = (request.headers["user-agent"]?.trim() || "Unknown client").slice(0, 160);
  return { clientLabel, ipAddressHash: createHmac("sha256", secret).update(address).digest("hex") };
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > 16_384) throw new Error("BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("INVALID_JSON"); }
}

function setHeaders(response: ServerResponse, requestId: string) {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-request-id", requestId);
}
function send(response: ServerResponse, status: number, body?: unknown) { response.writeHead(status).end(body === undefined ? undefined : JSON.stringify(body)); }
function sendError(response: ServerResponse, status: number, code: ApiErrorCode, message: string, requestId: string, details?: Record<string, string[]>) {
  send(response, status, apiError({ code, message, requestId, ...(details ? { details } : {}) }));
}
function validationDetails(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "request");
    (details[field] ??= []).push(issue.message);
  }
  return details;
}

export async function handleAuthRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/v1/auth/")) return false;
  const requestId = requestIdFrom(request.headers["x-request-id"]);
  setHeaders(response, requestId);
  const origin = allowedOrigin();
  if (request.headers.origin === origin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    response.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");
    send(response, 204); return true;
  }
  if ((request.method === "POST" || request.method === "DELETE") && !hasAllowedOrigin(request)) {
    sendError(response, 403, "FORBIDDEN", "Request origin is not allowed", requestId); return true;
  }
  if (request.method === "GET" && url.pathname.endsWith("/rate-limit-ready")) {
    const ready = await checkAuthRateLimitReadiness();
    send(response, ready ? 200 : 503, { status: ready ? "ready" : "unavailable" }); return true;
  }
  const authService = getService();
  try {
    if (request.method === "POST" && (url.pathname.endsWith("/register") || url.pathname.endsWith("/login"))) {
      const source = request.socket.remoteAddress ?? "unknown";
      const scope = url.pathname.endsWith("/register") ? "register" : "login";
      const rate = await getLimiter().consume(scope, source, RATE_LIMIT_POLICIES[scope]);
      if (!rate.allowed) {
        response.setHeader("retry-after", String(rate.retryAfterSeconds));
        sendError(response, 429, "RATE_LIMITED", "Too many authentication attempts", requestId); return true;
      }
      const schema = url.pathname.endsWith("/register") ? registerRequestSchema : loginRequestSchema;
      const parsed = schema.safeParse(await readJson(request));
      if (!parsed.success) {
        sendError(response, 422, "VALIDATION_ERROR", "Invalid request data", requestId, validationDetails(parsed.error)); return true;
      }
      if (scope === "login") {
        const accountRate = await getLimiter().consume("login-account", parsed.data.email, RATE_LIMIT_POLICIES["login-account"]);
        if (!accountRate.allowed) {
          response.setHeader("retry-after", String(accountRate.retryAfterSeconds));
          sendError(response, 429, "RATE_LIMITED", "Too many authentication attempts", requestId); return true;
        }
      }
      const result = url.pathname.endsWith("/register")
        ? await authService.register(parsed.data as never, sessionClientContext(request))
        : await authService.login(parsed.data as never, sessionClientContext(request));
      response.setHeader("set-cookie", createSessionCookie(result.token, result.maxAgeSeconds));
      await authService.recordSecurityEvent({ userId: result.response.user.id, eventType: url.pathname.endsWith("/register") ? "account_registered" : "login", outcome: "success", requestId });
      log("info", url.pathname.endsWith("/register") ? "auth_registered" : "auth_login_succeeded", { requestId });
      send(response, url.pathname.endsWith("/register") ? 201 : 200, result.response); return true;
    }
    if (request.method === "POST" && url.pathname.endsWith("/password/forgot")) {
      const rate = await getLimiter().consume("forgot", request.socket.remoteAddress ?? "unknown", RATE_LIMIT_POLICIES.forgot);
      if (!rate.allowed) {
        response.setHeader("retry-after", String(rate.retryAfterSeconds));
        sendError(response, 429, "RATE_LIMITED", "Too many recovery attempts", requestId); return true;
      }
      const parsed = emailRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        sendError(response, 422, "VALIDATION_ERROR", "Invalid request data", requestId, validationDetails(parsed.error)); return true;
      }
      const accountRate = await getLimiter().consume("forgot-account", parsed.data.email, RATE_LIMIT_POLICIES["forgot-account"]);
      if (!accountRate.allowed) {
        response.setHeader("retry-after", String(accountRate.retryAfterSeconds));
        sendError(response, 429, "RATE_LIMITED", "Too many recovery attempts", requestId); return true;
      }
      const userId = await authService.requestPasswordReset(parsed.data.email);
      await authService.recordSecurityEvent({ ...(userId ? { userId } : {}), eventType: "password_reset_requested", outcome: "success", requestId });
      log("info", "password_reset_requested", { requestId });
      send(response, 202, { message: "If an account exists, a reset email has been sent." }); return true;
    }
    if (request.method === "POST" && url.pathname.endsWith("/password/reset")) {
      const rate = await getLimiter().consume("reset", request.socket.remoteAddress ?? "unknown", RATE_LIMIT_POLICIES.reset);
      if (!rate.allowed) {
        response.setHeader("retry-after", String(rate.retryAfterSeconds));
        sendError(response, 429, "RATE_LIMITED", "Too many recovery attempts", requestId); return true;
      }
      const parsed = passwordResetRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        sendError(response, 422, "VALIDATION_ERROR", "Invalid request data", requestId, validationDetails(parsed.error)); return true;
      }
      const tokenRate = await getLimiter().consume("reset-token", parsed.data.token, RATE_LIMIT_POLICIES["reset-token"]);
      if (!tokenRate.allowed) {
        response.setHeader("retry-after", String(tokenRate.retryAfterSeconds));
        sendError(response, 429, "RATE_LIMITED", "Too many recovery attempts", requestId); return true;
      }
      const reset = await authService.resetPassword(parsed.data);
      await authService.recordSecurityEvent({ userId: reset.userId, eventType: "password_reset", outcome: "success", requestId });
      response.setHeader("set-cookie", clearSessionCookie());
      log("info", "password_reset_succeeded", { requestId });
      send(response, 204); return true;
    }
    if (request.method === "POST" && url.pathname.endsWith("/email/confirm")) {
      const parsed = tokenRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        sendError(response, 422, "VALIDATION_ERROR", "Invalid request data", requestId, validationDetails(parsed.error)); return true;
      }
      const userId = await authService.confirmEmailVerification(parsed.data.token);
      await authService.recordSecurityEvent({ userId, eventType: "email_verified", outcome: "success", requestId });
      log("info", "email_verification_succeeded", { requestId });
      send(response, 204); return true;
    }
    const token = readSessionCookie(request);
    if (request.method === "GET" && url.pathname.endsWith("/me")) {
      const user = token ? await authService.authenticate(token) : null;
      if (!user) sendError(response, 401, "UNAUTHENTICATED", "Authentication required", requestId);
      else send(response, 200, { user });
      return true;
    }
    if (request.method === "GET" && url.pathname.endsWith("/sessions")) {
      const context = token ? await authService.authenticateContext(token) : null;
      if (!context || !token) {
        sendError(response, 401, "UNAUTHENTICATED", "Authentication required", requestId); return true;
      }
      send(response, 200, { sessions: await authService.listSessions(context.user.id, token) }); return true;
    }
    if (request.method === "DELETE" && url.pathname.includes("/sessions/")) {
      const context = token ? await authService.authenticateContext(token) : null;
      if (!context) {
        sendError(response, 401, "UNAUTHENTICATED", "Authentication required", requestId); return true;
      }
      const sessionId = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        sendError(response, 404, "NOT_FOUND", "Session not found", requestId); return true;
      }
      const revoked = await authService.revokeSession(context.user.id, sessionId);
      if (!revoked) {
        sendError(response, 404, "NOT_FOUND", "Session not found", requestId); return true;
      }
      await authService.recordSecurityEvent({ userId: context.user.id, sessionId, eventType: "session_revoked", outcome: "success", requestId });
      if (sessionId === context.sessionId) response.setHeader("set-cookie", clearSessionCookie());
      send(response, 204); return true;
    }
    if (request.method === "GET" && url.pathname.endsWith("/security-events")) {
      const context = token ? await authService.authenticateContext(token) : null;
      if (!context) {
        sendError(response, 401, "UNAUTHENTICATED", "Authentication required", requestId); return true;
      }
      send(response, 200, { events: await authService.listSecurityEvents(context.user.id) }); return true;
    }
    if (request.method === "POST" && url.pathname.endsWith("/email/request")) {
      const user = token ? await authService.authenticate(token) : null;
      if (!user) {
        sendError(response, 401, "UNAUTHENTICATED", "Authentication required", requestId); return true;
      }
      const rate = await getLimiter().consume("verify", user.id, RATE_LIMIT_POLICIES.verify);
      if (!rate.allowed) {
        response.setHeader("retry-after", String(rate.retryAfterSeconds));
        sendError(response, 429, "RATE_LIMITED", "Too many verification attempts", requestId); return true;
      }
      await authService.requestEmailVerification(user.id);
      await authService.recordSecurityEvent({ userId: user.id, eventType: "email_verification_requested", outcome: "success", requestId });
      log("info", "email_verification_requested", { requestId });
      send(response, 202, { message: "If verification is needed, an email has been sent." }); return true;
    }
    if (request.method === "POST" && url.pathname.endsWith("/logout")) {
      const context = token ? await authService.authenticateContext(token) : null;
      if (token) await authService.logout(token);
      if (context) await authService.recordSecurityEvent({ userId: context.user.id, sessionId: context.sessionId, eventType: "logout", outcome: "success", requestId });
      response.setHeader("set-cookie", clearSessionCookie());
      log("info", "auth_logout", { requestId });
      send(response, 204); return true;
    }
    sendError(response, 404, "NOT_FOUND", "Route not found", requestId); return true;
  } catch (error) {
    if (error instanceof RateLimitBackendUnavailableError) {
      log("error", "rate_limit_backend_unavailable", { requestId });
      sendError(response, 503, "SERVICE_UNAVAILABLE", "Authentication service is temporarily unavailable", requestId);
    } else if (error instanceof InvalidCredentialsError) {
      await authService.recordSecurityEvent({ eventType: "login", outcome: "failure", requestId }).catch(() => undefined);
      log("warn", "auth_login_failed", { requestId });
      sendError(response, 401, "UNAUTHENTICATED", "Invalid email or password", requestId);
    } else if (error instanceof EmailConflictError) {
      sendError(response, 409, "CONFLICT", "An account with this email already exists", requestId);
    } else if (error instanceof InvalidAccountTokenError) {
      sendError(response, 400, "BAD_REQUEST", "The link is invalid or expired", requestId);
    } else if (error instanceof Error && new Set(["INVALID_JSON", "BODY_TOO_LARGE"]).has(error.message)) {
      sendError(response, 400, "BAD_REQUEST", "Invalid request body", requestId);
    } else {
      log("error", "auth_internal_error", { requestId });
      sendError(response, 500, "INTERNAL_ERROR", "An internal error occurred", requestId);
    }
    return true;
  }
}
