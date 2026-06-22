
-- =========================================
-- KAI.18 — Smart Coverage Engine schema
-- =========================================

CREATE TABLE IF NOT EXISTS public.kairos_coverage_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  prospect_id uuid NOT NULL,
  account_id uuid,
  company_name text,
  normalized_domain text,
  cnpj text,

  account_exists boolean NOT NULL DEFAULT false,
  contact_status text NOT NULL DEFAULT 'none' CHECK (contact_status IN ('none','partial','complete')),
  decision_maker_status text NOT NULL DEFAULT 'absent' CHECK (decision_maker_status IN ('found','partial','absent')),
  phone_exists boolean NOT NULL DEFAULT false,
  whatsapp_status text NOT NULL DEFAULT 'unknown' CHECK (whatsapp_status IN ('ready','unknown')),
  opportunity_status text NOT NULL DEFAULT 'none' CHECK (opportunity_status IN ('open','won','lost','none')),
  proposal_status text NOT NULL DEFAULT 'none' CHECK (proposal_status IN ('sent','viewed','accepted','declined','none')),
  customer_status text NOT NULL DEFAULT 'never' CHECK (customer_status IN ('active','former','never')),

  coverage_score integer NOT NULL DEFAULT 0 CHECK (coverage_score BETWEEN 0 AND 100),
  coverage_class text NOT NULL DEFAULT 'new' CHECK (coverage_class IN ('complete','good','partial','weak','new')),
  missing_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_best_action text,
  apollo_blocked boolean NOT NULL DEFAULT false,

  signature text NOT NULL,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kairos_coverage_analysis TO authenticated;
GRANT ALL ON public.kairos_coverage_analysis TO service_role;

ALTER TABLE public.kairos_coverage_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read coverage analysis"
  ON public.kairos_coverage_analysis
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Service role manages coverage analysis"
  ON public.kairos_coverage_analysis
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS kairos_coverage_analysis_prospect_sig_idx
  ON public.kairos_coverage_analysis (prospect_id, signature);
CREATE INDEX IF NOT EXISTS kairos_coverage_analysis_prospect_recent_idx
  ON public.kairos_coverage_analysis (prospect_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS kairos_coverage_analysis_org_class_idx
  ON public.kairos_coverage_analysis (organization_id, coverage_class);

CREATE OR REPLACE FUNCTION public.touch_kairos_coverage_analysis()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kairos_coverage_touch ON public.kairos_coverage_analysis;
CREATE TRIGGER trg_kairos_coverage_touch
  BEFORE UPDATE ON public.kairos_coverage_analysis
  FOR EACH ROW EXECUTE FUNCTION public.touch_kairos_coverage_analysis();

-- ----- kairos_qualified_queue -----
ALTER TABLE public.kairos_qualified_queue
  ADD COLUMN IF NOT EXISTS coverage_score integer,
  ADD COLUMN IF NOT EXISTS coverage_class text,
  ADD COLUMN IF NOT EXISTS missing_items jsonb,
  ADD COLUMN IF NOT EXISTS next_best_action text;

-- ----- kairos_revenue_attribution -----
ALTER TABLE public.kairos_revenue_attribution
  ADD COLUMN IF NOT EXISTS coverage_score_at_capture integer,
  ADD COLUMN IF NOT EXISTS coverage_class_at_capture text;

-- ----- apollo_auto_enrichment_rules -----
ALTER TABLE public.apollo_auto_enrichment_rules
  ADD COLUMN IF NOT EXISTS block_apollo_when_covered boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS coverage_block_threshold integer NOT NULL DEFAULT 90;
