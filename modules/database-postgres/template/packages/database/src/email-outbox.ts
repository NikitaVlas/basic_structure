import type { EmailOutboxRecord, Queryable } from "./types.js";

const RETURNING_FIELDS = `id, template, message_ciphertext, message_nonce, message_auth_tag,
  status, attempts, available_at, lease_owner, leased_until, delivered_at,
  last_error_category, created_at, updated_at`;
const CLAIM_RETURNING_FIELDS = `jobs.id, jobs.template, jobs.message_ciphertext, jobs.message_nonce,
  jobs.message_auth_tag, jobs.status, jobs.attempts, jobs.available_at, jobs.lease_owner,
  jobs.leased_until, jobs.delivered_at, jobs.last_error_category, jobs.created_at, jobs.updated_at`;

export type EncryptedOutboxMessage = Readonly<{
  ciphertext: string;
  nonce: string;
  authTag: string;
}>;

export class EmailOutboxRepository {
  constructor(private readonly database: Queryable) {}

  async enqueue(input: { template: EmailOutboxRecord["template"]; message: EncryptedOutboxMessage; availableAt?: Date }) {
    const result = await this.database.query<EmailOutboxRecord>(
      `INSERT INTO transactional_email_outbox
         (template, message_ciphertext, message_nonce, message_auth_tag, available_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${RETURNING_FIELDS}`,
      [input.template, input.message.ciphertext, input.message.nonce, input.message.authTag, input.availableAt ?? new Date()]
    );
    if (!result.rows[0]) throw new Error("Email outbox insert returned no row");
    return result.rows[0];
  }

  async claim(input: { leaseOwner: string; limit: number; now?: Date; leaseMs: number }) {
    const now = input.now ?? new Date();
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
    const leasedUntil = new Date(now.getTime() + input.leaseMs);
    const result = await this.database.query<EmailOutboxRecord>(
      `WITH candidates AS (
         SELECT id FROM transactional_email_outbox
         WHERE status = 'pending' AND available_at <= $1
           AND (leased_until IS NULL OR leased_until <= $1)
         ORDER BY available_at, created_at
         FOR UPDATE SKIP LOCKED LIMIT $2
       )
       UPDATE transactional_email_outbox AS jobs
       SET lease_owner = $3, leased_until = $4, attempts = jobs.attempts + 1, updated_at = $1
       FROM candidates WHERE jobs.id = candidates.id
       RETURNING ${CLAIM_RETURNING_FIELDS}`,
      [now, limit, input.leaseOwner, leasedUntil]
    );
    return result.rows;
  }

  async markDelivered(id: string, leaseOwner: string, now = new Date()) {
    const result = await this.database.query(
      `UPDATE transactional_email_outbox
       SET status = 'delivered', delivered_at = $3, lease_owner = NULL,
           leased_until = NULL, last_error_category = NULL, updated_at = $3
       WHERE id = $1 AND lease_owner = $2 AND status = 'pending'`,
      [id, leaseOwner, now]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async markFailed(input: { id: string; leaseOwner: string; attempts: number; maxAttempts: number; retryAt: Date; errorCategory: string; now?: Date }) {
    const now = input.now ?? new Date();
    const terminal = input.attempts >= input.maxAttempts;
    const result = await this.database.query(
      `UPDATE transactional_email_outbox
       SET status = $3, available_at = $4, lease_owner = NULL, leased_until = NULL,
           last_error_category = $5, updated_at = $6
       WHERE id = $1 AND lease_owner = $2 AND status = 'pending'`,
      [input.id, input.leaseOwner, terminal ? "failed" : "pending", input.retryAt, input.errorCategory.slice(0, 80), now]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteTerminalBefore(before: Date) {
    const result = await this.database.query(
      `DELETE FROM transactional_email_outbox
       WHERE status IN ('delivered', 'failed') AND updated_at < $1`,
      [before]
    );
    return result.rowCount ?? 0;
  }
}
