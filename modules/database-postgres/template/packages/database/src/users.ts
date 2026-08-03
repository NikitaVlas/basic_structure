import type { Queryable, UserRecord, UserRole } from "./types.js";

export class UserRepository {
  constructor(private readonly database: Queryable) {}

  async create(input: { emailNormalized: string; emailDisplay: string; passwordHash: string; role?: UserRole }) {
    const result = await this.database.query<UserRecord>(
      `INSERT INTO users (email_normalized, email_display, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email_normalized, email_display, password_hash, role, created_at, email_verified_at`,
      [input.emailNormalized, input.emailDisplay, input.passwordHash, input.role ?? "user"]
    );
    if (!result.rows[0]) throw new Error("User insert returned no row");
    return result.rows[0];
  }

  async findByNormalizedEmail(emailNormalized: string) {
    const result = await this.database.query<UserRecord>(
      `SELECT id, email_normalized, email_display, password_hash, role, created_at, email_verified_at
       FROM users WHERE email_normalized = $1`,
      [emailNormalized]
    );
    return result.rows[0] ?? null;
  }

  async findPublicById(id: string) {
    const result = await this.database.query<Pick<UserRecord, "id" | "email_display" | "role" | "created_at" | "email_verified_at">>(
      `SELECT id, email_display, role, created_at, email_verified_at FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }
}
