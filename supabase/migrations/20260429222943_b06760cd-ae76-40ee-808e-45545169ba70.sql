-- prospects: flags de enrichment Apollo
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS enrichment_status text,
  ADD COLUMN IF NOT EXISTS contact_score int,
  ADD COLUMN IF NOT EXISTS decision_maker_found boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apollo_enriched_at timestamptz;

-- enriched_contact_profiles: campos Apollo
ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS confidence_score int,
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apollo_person_id text,
  ADD COLUMN IF NOT EXISTS raw jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ectp_prospect_email
  ON public.enriched_contact_profiles (workspace_id, prospect_id, lower(email))
  WHERE email IS NOT NULL;

-- enrichment_jobs: auditoria por provider
CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  credits_used int DEFAULT 0,
  contacts_found int DEFAULT 0,
  decision_makers_found int DEFAULT 0,
  error text,
  request jsonb DEFAULT '{}'::jsonb,
  response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_ws_provider_prospect
  ON public.enrichment_jobs(workspace_id, provider, prospect_id);

ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrichment_jobs_org_select ON public.enrichment_jobs FOR SELECT
  USING (workspace_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));