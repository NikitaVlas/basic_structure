import type { Queryable, SecurityAuditEventRecord, SecurityAuditOutcome } from "./types.js";

export class SecurityAuditRepository {
  constructor(private readonly database: Queryable) {}

  async record(input: {
    userId?: string;
    sessionId?: string;
    eventType: string;
    outcome: SecurityAuditOutcome;
    requestId: string;
    metadata?: Record<string, unknown>;
  }) {
    const result = await this.database.query<SecurityAuditEventRecord>(
      `INSERT INTO security_audit_events (user_id, session_id, event_type, outcome, request_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, session_id, event_type, outcome, request_id, metadata, occurred_at`,
      [input.userId ?? null, input.sessionId ?? null, input.eventType, input.outcome, input.requestId, input.metadata ?? {}]
    );
    if (!result.rows[0]) throw new Error("Security audit insert returned no row");
    return result.rows[0];
  }

  async listRecentForUser(userId: string, limit = 50) {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const result = await this.database.query<SecurityAuditEventRecord>(
      `SELECT id, user_id, session_id, event_type, outcome, request_id, metadata, occurred_at
       FROM security_audit_events WHERE user_id = $1
       ORDER BY occurred_at DESC, id DESC LIMIT $2`,
      [userId, safeLimit]
    );
    return result.rows;
  }
}
