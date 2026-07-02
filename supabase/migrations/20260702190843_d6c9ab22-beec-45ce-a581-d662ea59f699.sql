-- KAI.19 Company Intelligence Engine

CREATE TABLE IF NOT EXISTS public.kairos_company_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  prospect_id UUID NOT NULL,
  account_id UUID,
  company_name TEXT NOT NULL,
  domain TEXT,
  cnpj TEXT,
  source_type TEXT,
  source_name TEXT,
  event_id UUID,
  event_name TEXT,
  icp_cluster_id UUID,
  icp_cluster_name TEXT,

  company_intelligence_score INTEGER NOT NULL DEFAULT 0,
  company_grade TEXT NOT NULL DEFAULT 'C',

  fit_score INTEGER DEFAULT 0,
  market_score INTEGER DEFAULT 0,
  size_score INTEGER DEFAULT 0,
  digital_presence_score INTEGER DEFAULT 0,
  event_relevance_score INTEGER DEFAULT 0,
  relationship_score INTEGER DEFAULT 0,
  coverage_score INTEGER DEFAULT 0,
  buying_signal_score INTEGER DEFAULT 0,
  urgency_score INTEGER DEFAULT 0,
  revenue_potential_score INTEGER DEFAULT 0,

  estimated_ticket_range TEXT,
  estimated_ltv_range TEXT,
  company_size TEXT,
  company_segment TEXT,
  company_industry TEXT,
  company_region TEXT,
  business_model TEXT,
  digital_maturity TEXT,
  event_participation_level TEXT,
  relationship_status TEXT,
  coverage_class TEXT,

  buying_signals JSONB DEFAULT '[]'::jsonb,
  risk_signals JSONB DEFAULT '[]'::jsonb,
  opportunity_hypotheses JSONB DEFAULT '[]'::jsonb,

  recommended_strategy TEXT,
  next_best_action TEXT,
  apollo_recommended BOOLEAN DEFAULT false,
  sdr_recommended BOOLEAN DEFAULT false,
  human_review_required BOOLEAN DEFAULT false,

  confidence_score INTEGER DEFAULT 0,
  missing_fields JSONB DEFAULT '[]'::jsonb,
  evidence JSONB DEFAULT '{}'::jsonb,
  prompt_version TEXT DEFAULT 'company_intelligence.v1.0',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kairos_company_intelligence TO authenticated;
GRANT ALL ON public.kairos_company_intelligence TO service_role;

ALTER TABLE public.kairos_company_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_company_intelligence"
  ON public.kairos_company_intelligence FOR SELECT TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "service_role_manage_company_intelligence"
  ON public.kairos_company_intelligence FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kairos_company_intelligence_prospect
  ON public.kairos_company_intelligence(prospect_id);
CREATE INDEX IF NOT EXISTS idx_kairos_company_intelligence_org_grade
  ON public.kairos_company_intelligence(organization_id, company_grade, company_intelligence_score DESC);

CREATE TRIGGER trg_kairos_company_intelligence_updated_at
  BEFORE UPDATE ON public.kairos_company_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend qualified queue
ALTER TABLE public.kairos_qualified_queue
  ADD COLUMN IF NOT EXISTS company_intelligence_score INTEGER,
  ADD COLUMN IF NOT EXISTS company_grade TEXT,
  ADD COLUMN IF NOT EXISTS company_next_best_action TEXT,
  ADD COLUMN IF NOT EXISTS company_recommended_strategy TEXT,
  ADD COLUMN IF NOT EXISTS apollo_recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sdr_recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_human_review_required BOOLEAN DEFAULT false;
