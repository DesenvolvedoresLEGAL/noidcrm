
-- enriched_contact_profiles
ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS email_revealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_revealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_reveal_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS phone_reveal_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS email_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_channel text,
  ADD COLUMN IF NOT EXISTS reveal_source text,
  ADD COLUMN IF NOT EXISTS last_reveal_job_id uuid;

-- backfill
UPDATE public.enriched_contact_profiles
SET phone_revealed = true,
    phone_reveal_status = 'revealed',
    phone_revealed_at = COALESCE(phone_revealed_at, updated_at, created_at)
WHERE phone_revealed = false
  AND phone IS NOT NULL
  AND length(trim(phone)) > 0;

UPDATE public.enriched_contact_profiles
SET email_revealed = true,
    email_reveal_status = 'revealed',
    email_revealed_at = COALESCE(email_revealed_at, updated_at, created_at)
WHERE email_revealed = false
  AND email IS NOT NULL
  AND length(trim(email)) > 0;

UPDATE public.enriched_contact_profiles
SET preferred_channel = CASE
  WHEN phone_revealed THEN 'whatsapp'
  WHEN email_revealed THEN 'email'
  WHEN linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0 THEN 'linkedin'
  ELSE 'unknown'
END
WHERE preferred_channel IS NULL;

-- enrichment_jobs
ALTER TABLE public.enrichment_jobs
  ADD COLUMN IF NOT EXISTS requested_data_type text,
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS requested_channel text,
  ADD COLUMN IF NOT EXISTS credits_estimated integer,
  ADD COLUMN IF NOT EXISTS credits_used integer,
  ADD COLUMN IF NOT EXISTS skip_reason text,
  ADD COLUMN IF NOT EXISTS response_summary jsonb;

-- apollo_auto_enrichment_rules
ALTER TABLE public.apollo_auto_enrichment_rules
  ADD COLUMN IF NOT EXISTS auto_reveal_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reveal_phone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_reveal_both boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_reveal_min_score integer NOT NULL DEFAULT 220,
  ADD COLUMN IF NOT EXISTS phone_reveal_min_score integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS max_email_reveals_per_company integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_phone_reveals_per_company integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS fallback_to_email_if_no_phone boolean NOT NULL DEFAULT true;

-- apollo_reveal_audit
CREATE TABLE IF NOT EXISTS public.apollo_reveal_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  prospect_id uuid,
  contact_id uuid,
  job_id uuid,
  requested_data_type text NOT NULL,
  requested_channel text,
  provider text NOT NULL DEFAULT 'apollo',
  status text NOT NULL,
  credits_estimated integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  email_before text,
  email_after text,
  phone_before text,
  phone_after text,
  requested_by uuid,
  source text,
  reason text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.apollo_reveal_audit TO authenticated;
GRANT ALL ON public.apollo_reveal_audit TO service_role;

ALTER TABLE public.apollo_reveal_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read apollo reveal audit" ON public.apollo_reveal_audit;
CREATE POLICY "Org members can read apollo reveal audit"
ON public.apollo_reveal_audit
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Service role manages apollo reveal audit" ON public.apollo_reveal_audit;
CREATE POLICY "Service role manages apollo reveal audit"
ON public.apollo_reveal_audit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_apollo_reveal_audit_org_created
  ON public.apollo_reveal_audit (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apollo_reveal_audit_prospect
  ON public.apollo_reveal_audit (prospect_id);
CREATE INDEX IF NOT EXISTS idx_apollo_reveal_audit_contact
  ON public.apollo_reveal_audit (contact_id);
