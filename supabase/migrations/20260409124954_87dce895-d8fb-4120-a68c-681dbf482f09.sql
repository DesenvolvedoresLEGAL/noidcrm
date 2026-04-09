
-- =============================================
-- Sprint 1: Lead Sourcing Engine Foundation
-- =============================================

-- 1. Evolve icp_profiles with new targeting columns
ALTER TABLE public.icp_profiles
  ADD COLUMN IF NOT EXISTS industries jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS company_size_min int,
  ADD COLUMN IF NOT EXISTS company_size_max int,
  ADD COLUMN IF NOT EXISTS geo_targets jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS keywords_include jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS keywords_exclude jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS buyer_personas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trigger_signals jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS disqualifiers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS priority_rules jsonb DEFAULT '{}'::jsonb;

-- 2. sourcing_playbooks
CREATE TABLE public.sourcing_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'sourcing',
  playbook_type text NOT NULL,
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_mode text DEFAULT 'manual',
  auto_create_opportunities boolean DEFAULT false,
  auto_assign_owner boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sourcing_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sourcing_playbooks_org_access" ON public.sourcing_playbooks
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_sourcing_playbooks_org_type ON public.sourcing_playbooks(organization_id, playbook_type, is_active);

-- 3. playbook_runs
CREATE TABLE public.playbook_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_id uuid REFERENCES public.sourcing_playbooks(id) ON DELETE SET NULL,
  icp_profile_id uuid REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  triggered_by uuid,
  status text NOT NULL DEFAULT 'queued',
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.playbook_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbook_runs_org_access" ON public.playbook_runs
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_playbook_runs_org_status ON public.playbook_runs(organization_id, status, created_at DESC);

-- 4. lead_sources
CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_run_id uuid NOT NULL REFERENCES public.playbook_runs(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_label text,
  source_url text,
  source_metadata jsonb DEFAULT '{}'::jsonb,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_sources_org_access" ON public.lead_sources
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- 5. source_pages
CREATE TABLE public.source_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_run_id uuid NOT NULL REFERENCES public.playbook_runs(id) ON DELETE CASCADE,
  lead_source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  url text NOT NULL,
  page_type text,
  status text DEFAULT 'pending',
  confidence numeric(5,2),
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.source_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "source_pages_org_access" ON public.source_pages
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- 6. prospects
CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_run_id uuid NOT NULL REFERENCES public.playbook_runs(id) ON DELETE CASCADE,
  icp_profile_id uuid REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  normalized_company_name text,
  website text,
  normalized_domain text,
  industry text,
  subcategory text,
  country text DEFAULT 'Brasil',
  state text,
  city text,
  phone_public text,
  email_public text,
  linkedin_url text,
  summary text,
  status text DEFAULT 'review_pending',
  confidence numeric(5,2),
  raw_data jsonb DEFAULT '{}'::jsonb,
  normalized_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_org_access" ON public.prospects
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_prospects_org_run ON public.prospects(organization_id, playbook_run_id);
CREATE INDEX idx_prospects_org_domain ON public.prospects(organization_id, normalized_domain);
CREATE INDEX idx_prospects_org_name ON public.prospects(organization_id, normalized_company_name);

-- 7. prospect_signals
CREATE TABLE public.prospect_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  signal_value text,
  weight numeric(6,2) DEFAULT 0,
  confidence numeric(5,2),
  source_reference text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.prospect_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospect_signals_org_access" ON public.prospect_signals
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- 8. prospect_scores
CREATE TABLE public.prospect_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  icp_fit_score numeric(6,2) DEFAULT 0,
  signal_score numeric(6,2) DEFAULT 0,
  data_quality_score numeric(6,2) DEFAULT 0,
  source_trust_score numeric(6,2) DEFAULT 0,
  penalty_score numeric(6,2) DEFAULT 0,
  priority_score numeric(6,2) GENERATED ALWAYS AS (
    icp_fit_score + signal_score + data_quality_score + source_trust_score - penalty_score
  ) STORED,
  reasoning jsonb DEFAULT '{}'::jsonb,
  grade text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prospect_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospect_scores_org_access" ON public.prospect_scores
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_prospect_scores_org_priority ON public.prospect_scores(organization_id, priority_score DESC);

-- 9. dedupe_registry
CREATE TABLE public.dedupe_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_key text NOT NULL,
  entity_value text NOT NULL,
  source_entity_id uuid,
  matched_entity_id uuid,
  match_type text,
  match_score numeric(6,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dedupe_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dedupe_registry_org_access" ON public.dedupe_registry
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_dedupe_registry_org_key ON public.dedupe_registry(organization_id, entity_type, entity_key);
