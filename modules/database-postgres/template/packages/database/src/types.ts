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
}
export interface SessionRecord {
  id: string;
  user_id: string;
  token_digest: string;
  expires_at: Date;
  created_at: Date;
}
