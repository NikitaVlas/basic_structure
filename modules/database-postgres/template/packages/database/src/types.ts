import type { QueryResult, QueryResultRow } from "pg";

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
}

export type UserRole = "user" | "admin";
export interface UserRecord {
  id: string;
  email_normalized: string;
  email_display: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  email_verified_at: Date | null;
}
export interface SessionRecord {
  id: string;
  user_id: string;
  token_digest: string;
  expires_at: Date;
  created_at: Date;
  client_label: string;
  ip_address_hash: string | null;
  last_seen_at: Date;
}
export type AccountTokenPurpose = "verify_email" | "reset_password";
export interface AccountTokenRecord {
  id: string;
  user_id: string;
  purpose: AccountTokenPurpose;
  token_digest: string;
  expires_at: Date;
  created_at: Date;
}
export type SecurityAuditOutcome = "success" | "failure";
export interface SecurityAuditEventRecord {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_type: string;
  outcome: SecurityAuditOutcome;
  request_id: string;
  metadata: Record<string, unknown>;
  occurred_at: Date;
}
