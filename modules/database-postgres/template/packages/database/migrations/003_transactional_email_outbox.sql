CREATE TABLE transactional_email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template TEXT NOT NULL CHECK (template IN ('verify-email', 'reset-password')),
  message_ciphertext TEXT NOT NULL,
  message_nonce TEXT NOT NULL,
  message_auth_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner UUID,
  leased_until TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  last_error_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(message_ciphertext) BETWEEN 1 AND 200000),
  CHECK (length(message_nonce) BETWEEN 16 AND 64),
  CHECK (length(message_auth_tag) BETWEEN 16 AND 64),
  CHECK (last_error_category IS NULL OR length(last_error_category) BETWEEN 1 AND 80),
  CHECK ((lease_owner IS NULL) = (leased_until IS NULL))
);

CREATE INDEX transactional_email_outbox_claim_idx
  ON transactional_email_outbox(available_at, created_at)
  WHERE status = 'pending';

CREATE INDEX transactional_email_outbox_retention_idx
  ON transactional_email_outbox(status, updated_at);
