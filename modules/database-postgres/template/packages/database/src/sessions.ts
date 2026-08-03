import type { Queryable, SessionRecord, UserRecord } from "./types.js";

export class SessionRepository {
  constructor(private readonly database: Queryable) {}

  async create(input: { userId: string; tokenDigest: string; expiresAt: Date }) {
    const result = await this.database.query<SessionRecord>(
      `INSERT INTO sessions (user_id, token_digest, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, token_digest, expires_at, created_at`,
      [input.userId, input.tokenDigest, input.expiresAt]
    );
    if (!result.rows[0]) throw new Error("Session insert returned no row");
    return result.rows[0];
  }

  async findActiveUserByDigest(tokenDigest: string, now = new Date()) {
    const result = await this.database.query<Pick<UserRecord, "id" | "email_display" | "role" | "created_at">>(
      `SELECT u.id, u.email_display, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_digest = $1 AND s.expires_at > $2`,
      [tokenDigest, now]
    );
    return result.rows[0] ?? null;
  }

  async deleteByDigest(tokenDigest: string) {
    await this.database.query(`DELETE FROM sessions WHERE token_digest = $1`, [tokenDigest]);
  }

  async deleteExpired(now = new Date()) {
    const result = await this.database.query(`DELETE FROM sessions WHERE expires_at <= $1`, [now]);
    return result.rowCount ?? 0;
  }
}
