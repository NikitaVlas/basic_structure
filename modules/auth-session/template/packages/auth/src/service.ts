import type { AuthResponse, LoginRequest, RegisterRequest, UserDto } from "@{{PROJECT_NAME}}/contracts";
import type { SessionRepository, UserRecord, UserRepository } from "@{{PROJECT_NAME}}/database";
import { hashPassword, verifyPassword } from "./password.js";
import { createSessionToken, digestSessionToken } from "./session-token.js";

export class InvalidCredentialsError extends Error {}
export class EmailConflictError extends Error {}

function toUserDto(user: Pick<UserRecord, "id" | "email_display" | "role" | "created_at">): UserDto {
  return { id: user.id, email: user.email_display, role: user.role, createdAt: user.created_at.toISOString() };
}

function isUniqueViolation(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "23505"; }

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly sessionDurationMs = 7 * 24 * 60 * 60 * 1000
  ) {}

  private async issueSession(user: Pick<UserRecord, "id" | "email_display" | "role" | "created_at">) {
    const token = createSessionToken();
    await this.sessions.create({ userId: user.id, tokenDigest: digestSessionToken(token), expiresAt: new Date(Date.now() + this.sessionDurationMs) });
    return { response: { user: toUserDto(user) } satisfies AuthResponse, token, maxAgeSeconds: Math.floor(this.sessionDurationMs / 1000) };
  }

  async register(input: RegisterRequest) {
    try {
      const user = await this.users.create({
        emailNormalized: input.email,
        emailDisplay: input.email,
        passwordHash: await hashPassword(input.password)
      });
      return await this.issueSession(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailConflictError();
      throw error;
    }
  }

  async login(input: LoginRequest) {
    const user = await this.users.findByNormalizedEmail(input.email);
    const valid = user ? await verifyPassword(input.password, user.password_hash) : (await hashPassword(input.password), false);
    if (!user || !valid) throw new InvalidCredentialsError();
    return await this.issueSession(user);
  }

  async authenticate(token: string) {
    const user = await this.sessions.findActiveUserByDigest(digestSessionToken(token));
    return user ? toUserDto(user) : null;
  }

  async logout(token: string) { await this.sessions.deleteByDigest(digestSessionToken(token)); }
}
