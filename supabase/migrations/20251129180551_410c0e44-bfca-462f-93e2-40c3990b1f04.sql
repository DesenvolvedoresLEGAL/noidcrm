-- Create table to store OAuth nonces for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nonce text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('gmail', 'google-calendar')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz
);

-- Index for efficient lookups
CREATE INDEX idx_oauth_nonces_nonce ON oauth_nonces(nonce) WHERE used_at IS NULL;
CREATE INDEX idx_oauth_nonces_expires ON oauth_nonces(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE oauth_nonces ENABLE ROW LEVEL SECURITY;

-- Policy: System manages nonces (no direct user access)
CREATE POLICY "System manages OAuth nonces"
ON oauth_nonces FOR ALL
USING (false)
WITH CHECK (false);

-- Function to cleanup expired nonces (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_nonces()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM oauth_nonces
  WHERE expires_at < now()
     OR (used_at IS NOT NULL AND used_at < now() - interval '1 hour');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE oauth_nonces IS 'Stores one-time nonces for OAuth CSRF protection';
COMMENT ON FUNCTION cleanup_expired_oauth_nonces IS 'Removes expired and used OAuth nonces';