import type { AuthResponse, LoginRequest, PasswordResetRequest, RegisterRequest, SecurityEventDto, SessionDto, UserDto } from "@{{PROJECT_NAME}}/contracts";
import { AccountTokenRepository, EmailOutboxRepository, SessionRepository, UserRepository, withDatabaseTransaction, type SecurityAuditOutcome, type SecurityAuditRepository, type UserRecord } from "@{{PROJECT_NAME}}/database";
import { passwordResetEmail, sealEmail, verificationEmail } from "@{{PROJECT_NAME}}/email";
import type { Pool } from "pg";
import { hashPassword, verifyPassword } from "./password.js";
import { createOpaqueToken, createSessionToken, digestOpaqueToken, digestSessionToken } from "./session-token.js";

export class InvalidCredentialsError extends Error {}
export class EmailConflictError extends Error {}
export class InvalidAccountTokenError extends Error {}

function toUserDto(user: Pick<UserRecord, "id" | "email_display" | "role" | "created_at" | "email_verified_at">): UserDto {
  return { id: user.id, email: user.email_display, role: user.role, createdAt: user.created_at.toISOString(), emailVerified: user.email_verified_at !== null };
}

function isUniqueViolation(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "23505"; }

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly accountTokens: AccountTokenRepository,
    private readonly securityAudit: SecurityAuditRepository,
    private readonly pool: Pool,
    private readonly sessionDurationMs = 7 * 24 * 60 * 60 * 1000
  ) {}

  private async issueSession(user: Pick<UserRecord, "id" | "email_display" | "role" | "created_at" | "email_verified_at">, context?: { clientLabel: string; ipAddressHash: string }) {
    const token = createSessionToken();
    await this.sessions.create({
      userId: user.id,
      tokenDigest: digestSessionToken(token),
      expiresAt: new Date(Date.now() + this.sessionDurationMs),
      ...(context ? context : {})
    });
    return { response: { user: toUserDto(user) } satisfies AuthResponse, token, maxAgeSeconds: Math.floor(this.sessionDurationMs / 1000) };
  }

  private sessionResult(user: Pick<UserRecord, "id" | "email_display" | "role" | "created_at" | "email_verified_at">, token: string) {
    return { response: { user: toUserDto(user) } satisfies AuthResponse, token, maxAgeSeconds: Math.floor(this.sessionDurationMs / 1000) };
  }

  private async issueAccountToken(user: Pick<UserRecord, "id" | "email_display">, purpose: "verify_email" | "reset_password") {
    const token = createOpaqueToken();
    const expiresInMs = purpose === "verify_email" ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
    const message = purpose === "verify_email"
      ? verificationEmail(user.email_display, token)
      : passwordResetEmail(user.email_display, token);
    const encrypted = sealEmail(message);
    await withDatabaseTransaction(this.pool, async (client) => {
      await new AccountTokenRepository(client).issue({ userId: user.id, purpose, tokenDigest: digestOpaqueToken(token), expiresAt: new Date(Date.now() + expiresInMs) });
      await new EmailOutboxRepository(client).enqueue({ template: message.template, message: encrypted });
    });
  }

  async register(input: RegisterRequest, context?: { clientLabel: string; ipAddressHash: string }) {
    try {
      const verificationToken = createOpaqueToken();
      const message = verificationEmail(input.email, verificationToken);
      const encrypted = sealEmail(message);
      const sessionToken = createSessionToken();
      const passwordHash = await hashPassword(input.password);
      return await withDatabaseTransaction(this.pool, async (client) => {
        const user = await new UserRepository(client).create({
          emailNormalized: input.email,
          emailDisplay: input.email,
          passwordHash
        });
        await new AccountTokenRepository(client).issue({
          userId: user.id,
          purpose: "verify_email",
          tokenDigest: digestOpaqueToken(verificationToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        await new EmailOutboxRepository(client).enqueue({ template: message.template, message: encrypted });
        await new SessionRepository(client).create({
          userId: user.id,
          tokenDigest: digestSessionToken(sessionToken),
          expiresAt: new Date(Date.now() + this.sessionDurationMs),
          ...(context ? context : {})
        });
        return this.sessionResult(user, sessionToken);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailConflictError();
      throw error;
    }
  }

  async login(input: LoginRequest, context?: { clientLabel: string; ipAddressHash: string }) {
    const user = await this.users.findByNormalizedEmail(input.email);
    const valid = user ? await verifyPassword(input.password, user.password_hash) : (await hashPassword(input.password), false);
    if (!user || !valid) throw new InvalidCredentialsError();
    return await this.issueSession(user, context);
  }

  async authenticate(token: string) {
    const user = await this.sessions.findActiveUserByDigest(digestSessionToken(token));
    return user ? toUserDto(user) : null;
  }

  async authenticateContext(token: string) {
    const context = await this.sessions.findActiveContextByDigest(digestSessionToken(token));
    return context ? { user: toUserDto(context), sessionId: context.session_id } : null;
  }

  async logout(token: string) { await this.sessions.deleteByDigest(digestSessionToken(token)); }

  async requestEmailVerification(userId: string) {
    const user = await this.users.findPublicById(userId);
    if (user && !user.email_verified_at) await this.issueAccountToken(user, "verify_email");
  }

  async confirmEmailVerification(token: string) {
    const userId = await this.accountTokens.consumeEmailVerification(digestOpaqueToken(token));
    if (!userId) throw new InvalidAccountTokenError();
    return userId;
  }

  async requestPasswordReset(emailNormalized: string) {
    const user = await this.users.findByNormalizedEmail(emailNormalized);
    if (user) await this.issueAccountToken(user, "reset_password");
    return user?.id ?? null;
  }

  async resetPassword(input: PasswordResetRequest) {
    const result = await this.accountTokens.consumePasswordReset(
      digestOpaqueToken(input.token),
      await hashPassword(input.password)
    );
    if (!result) throw new InvalidAccountTokenError();
    return result;
  }

  async listSessions(userId: string, currentToken: string): Promise<SessionDto[]> {
    const currentDigest = digestSessionToken(currentToken);
    return (await this.sessions.listForUser(userId)).map((session) => ({
      id: session.id,
      clientLabel: session.client_label,
      createdAt: session.created_at.toISOString(),
      lastSeenAt: session.last_seen_at.toISOString(),
      expiresAt: session.expires_at.toISOString(),
      current: session.token_digest === currentDigest
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    return this.sessions.deleteOwnedById(userId, sessionId);
  }

  async recordSecurityEvent(input: { userId?: string; sessionId?: string; eventType: string; outcome: SecurityAuditOutcome; requestId: string }) {
    await this.securityAudit.record(input);
  }

  async listSecurityEvents(userId: string): Promise<SecurityEventDto[]> {
    return (await this.securityAudit.listRecentForUser(userId)).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      outcome: event.outcome,
      occurredAt: event.occurred_at.toISOString()
    }));
  }
}
