
ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS is_hidden_recommendation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS requested_titles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS title_match_score int NULL;

CREATE INDEX IF NOT EXISTS idx_enriched_contacts_hidden
  ON public.enriched_contact_profiles (prospect_id, is_hidden_recommendation);
