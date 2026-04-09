
-- 1. enrichment_runs
CREATE TABLE public.enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  trigger_source text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  providers_requested jsonb DEFAULT '[]'::jsonb,
  providers_completed jsonb DEFAULT '[]'::jsonb,
  providers_failed jsonb DEFAULT '[]'::jsonb,
  merge_status text DEFAULT 'pending',
  enrichment_score numeric(6,2) DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.enrichment_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_enrichment_runs" ON public.enrichment_runs FOR SELECT USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_insert_enrichment_runs" ON public.enrichment_runs FOR INSERT WITH CHECK (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_update_enrichment_runs" ON public.enrichment_runs FOR UPDATE USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE INDEX idx_enrichment_runs_ws_prospect ON public.enrichment_runs(workspace_id, prospect_id, created_at DESC);

-- 2. enrichment_provider_results
CREATE TABLE public.enrichment_provider_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrichment_run_id uuid NOT NULL REFERENCES public.enrichment_runs(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  provider_entity_type text NOT NULL,
  provider_status text NOT NULL,
  raw_response jsonb DEFAULT '{}'::jsonb,
  normalized_response jsonb DEFAULT '{}'::jsonb,
  confidence numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.enrichment_provider_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_epr" ON public.enrichment_provider_results FOR SELECT USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_insert_epr" ON public.enrichment_provider_results FOR INSERT WITH CHECK (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE INDEX idx_epr_ws_run ON public.enrichment_provider_results(workspace_id, enrichment_run_id, provider_name);

-- 3. enriched_company_profiles
CREATE TABLE public.enriched_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  canonical_company_name text,
  canonical_domain text,
  company_summary text,
  business_model text,
  market_type text,
  company_size_estimate text,
  geographic_presence jsonb DEFAULT '[]'::jsonb,
  products_services jsonb DEFAULT '[]'::jsonb,
  industries_detected jsonb DEFAULT '[]'::jsonb,
  tech_signals jsonb DEFAULT '[]'::jsonb,
  growth_signals jsonb DEFAULT '[]'::jsonb,
  event_signals jsonb DEFAULT '[]'::jsonb,
  commercial_pains jsonb DEFAULT '[]'::jsonb,
  strategic_notes text,
  source_priority jsonb DEFAULT '[]'::jsonb,
  confidence numeric(6,2) DEFAULT 0,
  last_enriched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.enriched_company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_ecp" ON public.enriched_company_profiles FOR SELECT USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_insert_ecp" ON public.enriched_company_profiles FOR INSERT WITH CHECK (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_update_ecp" ON public.enriched_company_profiles FOR UPDATE USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE INDEX idx_ecp_ws_prospect ON public.enriched_company_profiles(workspace_id, prospect_id);

-- 4. enriched_contact_profiles
CREATE TABLE public.enriched_contact_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  full_name text,
  first_name text,
  last_name text,
  role_title text,
  seniority text,
  department text,
  email text,
  email_status text,
  phone text,
  linkedin_url text,
  provider_priority jsonb DEFAULT '[]'::jsonb,
  confidence numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.enriched_contact_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_ectp" ON public.enriched_contact_profiles FOR SELECT USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_insert_ectp" ON public.enriched_contact_profiles FOR INSERT WITH CHECK (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE INDEX idx_ectp_ws_prospect ON public.enriched_contact_profiles(workspace_id, prospect_id);

-- 5. commercial_briefs
CREATE TABLE public.commercial_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrichment_run_id uuid NOT NULL REFERENCES public.enrichment_runs(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  executive_summary text,
  why_now text,
  probable_pains jsonb DEFAULT '[]'::jsonb,
  value_hypotheses jsonb DEFAULT '[]'::jsonb,
  recommended_pitch_angle text,
  recommended_channel text,
  first_touch_message text,
  objection_predictions jsonb DEFAULT '[]'::jsonb,
  confidence numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.commercial_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_cb" ON public.commercial_briefs FOR SELECT USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_insert_cb" ON public.commercial_briefs FOR INSERT WITH CHECK (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE INDEX idx_cb_ws_prospect ON public.commercial_briefs(workspace_id, prospect_id);

-- 6. enrichment_signals
CREATE TABLE public.enrichment_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrichment_run_id uuid NOT NULL REFERENCES public.enrichment_runs(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  signal_value text,
  source_provider text,
  source_reference text,
  weight numeric(6,2) DEFAULT 0,
  confidence numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.enrichment_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_es" ON public.enrichment_signals FOR SELECT USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_insert_es" ON public.enrichment_signals FOR INSERT WITH CHECK (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE INDEX idx_es_ws_signal ON public.enrichment_signals(workspace_id, signal_type);

-- 7. contact_enrichment_queue
CREATE TABLE public.contact_enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  requested_providers jsonb DEFAULT '[]'::jsonb,
  priority int DEFAULT 0,
  status text DEFAULT 'queued',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.contact_enrichment_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_ceq" ON public.contact_enrichment_queue FOR SELECT USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "org_members_insert_ceq" ON public.contact_enrichment_queue FOR INSERT WITH CHECK (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE INDEX idx_ceq_ws_status ON public.contact_enrichment_queue(workspace_id, status, priority DESC);
