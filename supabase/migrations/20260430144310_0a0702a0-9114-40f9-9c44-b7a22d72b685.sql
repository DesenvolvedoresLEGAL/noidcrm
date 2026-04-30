ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reveal_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reveal_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS reveal_status text;

CREATE INDEX IF NOT EXISTS idx_ecp_last_reveal_attempt
  ON public.enriched_contact_profiles(last_reveal_attempt_at);