import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { apiError, loginRequestSchema, registerRequestSchema, type ApiErrorCode } from "@{{PROJECT_NAME}}/contracts";
import { createDatabasePool, SessionRepository, UserRepository } from "@{{PROJECT_NAME}}/database";
import type { Pool } from "pg";
import { log } from "@{{PROJECT_NAME}}/observability";
import { clearSessionCookie, createSessionCookie, readSessionCookie } from "./cookies.js";
import { FixedWindowRateLimiter } from "./rate-limit.js";
import { AuthService, EmailConflictError, InvalidCredentialsError } from "./service.js";

const limiter = new FixedWindowRateLimiter();
let service: AuthService | undefined;
let pool: Pool | undefined;
function getService() {
  if (!service) {
    const durationDays = Number.parseInt(process.env.SESSION_DURATION_DAYS ?? "7", 10);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) throw new Error("SESSION_DURATION_DAYS must be an integer from 1 to 30");
    pool = createDatabasePool();
    service = new AuthService(new UserRepository(pool), new SessionRepository(pool), durationDays * 24 * 60 * 60 * 1000);
  }
  return service;
}

export async function closeAuthResources() {
  const activePool = pool;
  pool = undefined;
  service = undefined;
  limiter.clear();
  if (activePool) await activePool.end();
}

function allowedOrigin() { return (process.env.APP_ORIGIN ?? "http://localhost:5173").replace(/\/$/, ""); }
function requestOrigin(request: IncomingMessage) {
  const value = request.headers.origin ?? request.headers.referer;
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}
function hasAllowedOrigin(request: IncomingMessage) { return requestOrigin(request) === allowedOrigin(); }

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
  const requestId = randomUUID();
  setHeaders(response, requestId);
  const origin = allowedOrigin();
  if (request.headers.origin === origin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");
    send(response, 204); return true;
  }
  if (request.method === "POST" && !hasAllowedOrigin(request)) {
    sendError(response, 403, "FORBIDDEN", "Request origin is not allowed", requestId); return true;
  }
  const authService = getService();
  try {
    if (request.method === "POST" && (url.pathname.endsWith("/register") || url.pathname.endsWith("/login"))) {
      const source = request.socket.remoteAddress ?? "unknown";
      const rate = limiter.consume(source);
      if (!rate.allowed) {
        response.setHeader("retry-after", String(rate.retryAfterSeconds));
        sendError(response, 429, "RATE_LIMITED", "Too many authentication attempts", requestId); return true;
      }
      const schema = url.pathname.endsWith("/register") ? registerRequestSchema : loginRequestSchema;
      const parsed = schema.safeParse(await readJson(request));
      if (!parsed.success) {
        sendError(response, 422, "VALIDATION_ERROR", "Invalid request data", requestId, validationDetails(parsed.error)); return true;
      }
      const result = url.pathname.endsWith("/register")
        ? await authService.register(parsed.data as never)
        : await authService.login(parsed.data as never);
      response.setHeader("set-cookie", createSessionCookie(result.token, result.maxAgeSeconds));
      log("info", url.pathname.endsWith("/register") ? "auth_registered" : "auth_login_succeeded", { requestId });
      send(response, url.pathname.endsWith("/register") ? 201 : 200, result.response); return true;
    }
    const token = readSessionCookie(request);
    if (request.method === "GET" && url.pathname.endsWith("/me")) {
      const user = token ? await authService.authenticate(token) : null;
      if (!user) sendError(response, 401, "UNAUTHENTICATED", "Authentication required", requestId);
      else send(response, 200, { user });
      return true;
    }
    if (request.method === "POST" && url.pathname.endsWith("/logout")) {
      if (token) await authService.logout(token);
      response.setHeader("set-cookie", clearSessionCookie());
      log("info", "auth_logout", { requestId });
      send(response, 204); return true;
    }
    sendError(response, 404, "NOT_FOUND", "Route not found", requestId); return true;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      log("warn", "auth_login_failed", { requestId });
      sendError(response, 401, "UNAUTHENTICATED", "Invalid email or password", requestId);
    } else if (error instanceof EmailConflictError) {
      sendError(response, 409, "CONFLICT", "An account with this email already exists", requestId);
    } else if (error instanceof Error && new Set(["INVALID_JSON", "BODY_TOO_LARGE"]).has(error.message)) {
      sendError(response, 400, "BAD_REQUEST", "Invalid request body", requestId);
    } else {
      log("error", "auth_internal_error", { requestId });
      sendError(response, 500, "INTERNAL_ERROR", "An internal error occurred", requestId);
    }
    return true;
  }
}
