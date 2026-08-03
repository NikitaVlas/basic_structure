ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

ALTER TABLE sessions
  ADD COLUMN client_label TEXT NOT NULL DEFAULT 'Unknown client',
  ADD COLUMN ip_address_hash TEXT,
  ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD CONSTRAINT sessions_client_label_length CHECK (length(client_label) BETWEEN 1 AND 160),
  ADD CONSTRAINT sessions_ip_hash_length CHECK (ip_address_hash IS NULL OR length(ip_address_hash) = 64);

CREATE TABLE account_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_digest TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (purpose, token_digest),
  UNIQUE (user_id, purpose),
  CHECK (length(token_digest) = 64)
);

CREATE INDEX account_tokens_expires_at_idx ON account_tokens(expires_at);

CREATE TABLE security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID,
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 3 AND 80),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX security_audit_events_user_time_idx
  ON security_audit_events(user_id, occurred_at DESC);
