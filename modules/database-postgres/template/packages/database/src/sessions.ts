import type { Queryable, SessionRecord, UserRecord } from "./types.js";

export class SessionRepository {
  constructor(private readonly database: Queryable) {}

  async create(input: { userId: string; tokenDigest: string; expiresAt: Date; clientLabel?: string; ipAddressHash?: string }) {
    const result = await this.database.query<SessionRecord>(
      `INSERT INTO sessions (user_id, token_digest, expires_at, client_label, ip_address_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, token_digest, expires_at, created_at, client_label, ip_address_hash, last_seen_at`,
      [input.userId, input.tokenDigest, input.expiresAt, input.clientLabel ?? "Unknown client", input.ipAddressHash ?? null]
    );
    if (!result.rows[0]) throw new Error("Session insert returned no row");
    return result.rows[0];
  }

  async findActiveUserByDigest(tokenDigest: string, now = new Date()) {
    const result = await this.database.query<Pick<UserRecord, "id" | "email_display" | "role" | "created_at" | "email_verified_at">>(
      `SELECT u.id, u.email_display, u.role, u.created_at, u.email_verified_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_digest = $1 AND s.expires_at > $2`,
      [tokenDigest, now]
    );
    return result.rows[0] ?? null;
  }

  async findActiveContextByDigest(tokenDigest: string, now = new Date()) {
    const result = await this.database.query<Pick<UserRecord, "id" | "email_display" | "role" | "created_at" | "email_verified_at"> & { session_id: string }>(
      `UPDATE sessions s SET last_seen_at = $2
       FROM users u
       WHERE s.user_id = u.id AND s.token_digest = $1 AND s.expires_at > $2
       RETURNING u.id, u.email_display, u.role, u.created_at, u.email_verified_at, s.id AS session_id`,
      [tokenDigest, now]
    );
    return result.rows[0] ?? null;
  }

  async deleteByDigest(tokenDigest: string) {
    await this.database.query(`DELETE FROM sessions WHERE token_digest = $1`, [tokenDigest]);
  }

  async listForUser(userId: string) {
    const result = await this.database.query<SessionRecord>(
      `SELECT id, user_id, token_digest, expires_at, created_at, client_label, ip_address_hash, last_seen_at
       FROM sessions WHERE user_id = $1 AND expires_at > now()
       ORDER BY last_seen_at DESC, id DESC`,
      [userId]
    );
    return result.rows;
  }

  async deleteOwnedById(userId: string, sessionId: string) {
    const result = await this.database.query(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllForUser(userId: string) {
    const result = await this.database.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    return result.rowCount ?? 0;
  }

  async deleteExpired(now = new Date()) {
    const result = await this.database.query(`DELETE FROM sessions WHERE expires_at <= $1`, [now]);
    return result.rowCount ?? 0;
  }
}
