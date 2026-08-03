import type { AccountTokenPurpose, AccountTokenRecord, Queryable } from "./types.js";

export class AccountTokenRepository {
  constructor(private readonly database: Queryable) {}

  async issue(input: { userId: string; purpose: AccountTokenPurpose; tokenDigest: string; expiresAt: Date }) {
    const result = await this.database.query<AccountTokenRecord>(
      `INSERT INTO account_tokens (user_id, purpose, token_digest, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, purpose) DO UPDATE
       SET token_digest = EXCLUDED.token_digest, expires_at = EXCLUDED.expires_at, created_at = now()
       RETURNING id, user_id, purpose, token_digest, expires_at, created_at`,
      [input.userId, input.purpose, input.tokenDigest, input.expiresAt]
    );
    if (!result.rows[0]) throw new Error("Account token insert returned no row");
    return result.rows[0];
  }

  async consumeEmailVerification(tokenDigest: string, now = new Date()) {
    const result = await this.database.query<{ user_id: string }>(
      `WITH consumed AS (
         DELETE FROM account_tokens
         WHERE purpose = 'verify_email' AND token_digest = $1 AND expires_at > $2
         RETURNING user_id
       )
       UPDATE users SET email_verified_at = COALESCE(email_verified_at, $2)
       WHERE id IN (SELECT user_id FROM consumed)
       RETURNING id AS user_id`,
      [tokenDigest, now]
    );
    return result.rows[0]?.user_id ?? null;
  }

  async consumePasswordReset(tokenDigest: string, passwordHash: string, now = new Date()) {
    const result = await this.database.query<{ user_id: string; revoked_sessions: string }>(
      `WITH consumed AS (
         DELETE FROM account_tokens
         WHERE purpose = 'reset_password' AND token_digest = $1 AND expires_at > $2
         RETURNING user_id
       ), updated AS (
         UPDATE users SET password_hash = $3
         WHERE id IN (SELECT user_id FROM consumed)
         RETURNING id
       ), revoked AS (
         DELETE FROM sessions WHERE user_id IN (SELECT id FROM updated)
         RETURNING id
       )
       SELECT id AS user_id, (SELECT count(*)::text FROM revoked) AS revoked_sessions FROM updated`,
      [tokenDigest, now, passwordHash]
    );
    const row = result.rows[0];
    return row ? { userId: row.user_id, revokedSessions: Number(row.revoked_sessions) } : null;
  }

  async deleteExpired(now = new Date()) {
    const result = await this.database.query(`DELETE FROM account_tokens WHERE expires_at <= $1`, [now]);
    return result.rowCount ?? 0;
  }
}
