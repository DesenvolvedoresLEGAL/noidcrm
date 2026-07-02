-- KAI.18.7 — Apollo Browser Parity

ALTER TABLE public.enriched_company_profiles
  ADD COLUMN IF NOT EXISTS apollo_organization_id text,
  ADD COLUMN IF NOT EXISTS apollo_organization_name text,
  ADD COLUMN IF NOT EXISTS apollo_organization_domain text,
  ADD COLUMN IF NOT EXISTS apollo_organization_confidence integer,
  ADD COLUMN IF NOT EXISTS apollo_organization_resolution_source text,
  ADD COLUMN IF NOT EXISTS apollo_organization_resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ecp_apollo_org_id
  ON public.enriched_company_profiles(apollo_organization_id)
  WHERE apollo_organization_id IS NOT NULL;

ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS manual_import boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_validation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_note text;

CREATE TABLE IF NOT EXISTS public.apollo_browser_parity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  prospect_id uuid,
  company_name text,
  domain text,
  apollo_web_url text,
  apollo_web_contacts_count integer,
  kairos_endpoint text,
  kairos_payload jsonb,
  kairos_response_summary jsonb,
  kairos_contacts_count integer,
  kairos_parser_count integer,
  kairos_filter_count integer,
  kairos_credits_used integer,
  kairos_status text,
  kairos_request_id text,
  har_uploaded boolean NOT NULL DEFAULT false,
  har_summary jsonb,
  har_candidate_requests jsonb,
  selected_har_request jsonb,
  diff_summary jsonb,
  parity_status text NOT NULL DEFAULT 'unknown',
  root_cause text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apollo_browser_parity_logs TO authenticated;
GRANT ALL ON public.apollo_browser_parity_logs TO service_role;

ALTER TABLE public.apollo_browser_parity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read parity logs"
  ON public.apollo_browser_parity_logs FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "org members insert parity logs"
  ON public.apollo_browser_parity_logs FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "org members update parity logs"
  ON public.apollo_browser_parity_logs FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE INDEX IF NOT EXISTS idx_apollo_parity_org_created
  ON public.apollo_browser_parity_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apollo_parity_prospect
  ON public.apollo_browser_parity_logs(prospect_id, created_at DESC);

CREATE TRIGGER trg_apollo_parity_updated_at
  BEFORE UPDATE ON public.apollo_browser_parity_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.apollo_query_logs
  ADD COLUMN IF NOT EXISTS zero_result_with_credits boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS strategies_tried jsonb,
  ADD COLUMN IF NOT EXISTS organization_resolution jsonb;