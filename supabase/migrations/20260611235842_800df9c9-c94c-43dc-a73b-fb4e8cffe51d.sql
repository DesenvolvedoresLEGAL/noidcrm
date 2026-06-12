
-- 1) Rules table
CREATE TABLE public.apollo_auto_enrichment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  minimum_priority_score integer NOT NULL DEFAULT 180,
  allowed_quality_labels text[] NOT NULL DEFAULT ARRAY['high_confidence','usable']::text[],
  required_domain boolean NOT NULL DEFAULT true,
  allowed_relationship_status text[] NOT NULL DEFAULT ARRAY['new_prospect']::text[],
  allowed_icps uuid[] NULL,
  max_contacts_per_company integer NOT NULL DEFAULT 3,
  max_apollo_credits_per_day integer NOT NULL DEFAULT 500,
  max_apollo_credits_per_batch integer NOT NULL DEFAULT 200,
  auto_select_primary_contact boolean NOT NULL DEFAULT true,
  auto_reveal_contact boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apollo_auto_enrichment_rules TO authenticated;
GRANT ALL ON public.apollo_auto_enrichment_rules TO service_role;

ALTER TABLE public.apollo_auto_enrichment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read apollo rules"
ON public.apollo_auto_enrichment_rules FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = apollo_auto_enrichment_rules.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "org admins write apollo rules"
ON public.apollo_auto_enrichment_rules FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = apollo_auto_enrichment_rules.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin','manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = apollo_auto_enrichment_rules.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin','manager')
  )
);

CREATE TRIGGER trg_apollo_rules_updated_at
BEFORE UPDATE ON public.apollo_auto_enrichment_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Audit table
CREATE TABLE public.apollo_enrichment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  batch_run_id uuid NULL,
  prospect_id uuid NOT NULL,
  company_name text NULL,
  apollo_status text NOT NULL CHECK (apollo_status IN ('skipped','partial','enriched','failed')),
  skip_reason text NULL,
  credits_used integer NOT NULL DEFAULT 0,
  contacts_found integer NOT NULL DEFAULT 0,
  contacts_revealed integer NOT NULL DEFAULT 0,
  primary_contact_id uuid NULL,
  decision_maker_found boolean NOT NULL DEFAULT false,
  icp_id uuid NULL,
  icp_category text NULL,
  priority_score integer NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_apollo_audit_org_created ON public.apollo_enrichment_audit(organization_id, created_at DESC);
CREATE INDEX idx_apollo_audit_batch ON public.apollo_enrichment_audit(batch_run_id);
CREATE INDEX idx_apollo_audit_prospect ON public.apollo_enrichment_audit(prospect_id);

GRANT SELECT ON public.apollo_enrichment_audit TO authenticated;
GRANT ALL ON public.apollo_enrichment_audit TO service_role;

ALTER TABLE public.apollo_enrichment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read apollo audit"
ON public.apollo_enrichment_audit FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = apollo_enrichment_audit.organization_id
      AND om.user_id = auth.uid()
  )
);

-- 3) Extend qualified queue
ALTER TABLE public.kairos_qualified_queue
  ADD COLUMN IF NOT EXISTS apollo_status text NULL,
  ADD COLUMN IF NOT EXISTS contacts_found integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primary_contact_name text NULL,
  ADD COLUMN IF NOT EXISTS primary_contact_role text NULL,
  ADD COLUMN IF NOT EXISTS primary_contact_score integer NULL;

-- 4) Helper functions
CREATE OR REPLACE FUNCTION public.fn_apollo_credits_used_today(p_org uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(credits_used), 0)::integer
  FROM public.apollo_enrichment_audit
  WHERE organization_id = p_org
    AND created_at >= now() - interval '24 hours';
$$;

CREATE OR REPLACE FUNCTION public.fn_apollo_should_run(p_prospect_id uuid, p_org uuid)
RETURNS TABLE(eligible boolean, reason text, priority_score integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules public.apollo_auto_enrichment_rules%ROWTYPE;
  v_queue public.kairos_qualified_queue%ROWTYPE;
  v_prospect_domain text;
  v_quality text;
  v_score integer;
  v_credits_used integer;
BEGIN
  SELECT * INTO v_rules FROM public.apollo_auto_enrichment_rules WHERE organization_id = p_org;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'no_rules_configured', 0; RETURN;
  END IF;
  IF NOT v_rules.enabled THEN
    RETURN QUERY SELECT false, 'apollo_disabled', 0; RETURN;
  END IF;

  SELECT * INTO v_queue FROM public.kairos_qualified_queue
    WHERE prospect_id = p_prospect_id AND organization_id = p_org
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_in_queue', 0; RETURN;
  END IF;

  v_score := COALESCE(v_queue.score, 0);

  IF NOT (v_queue.relationship_status = ANY(v_rules.allowed_relationship_status)) THEN
    RETURN QUERY SELECT false, 'relationship_not_allowed', v_score; RETURN;
  END IF;

  IF v_score < v_rules.minimum_priority_score THEN
    RETURN QUERY SELECT false, 'below_minimum_score', v_score; RETURN;
  END IF;

  SELECT COALESCE(quality_label, '') INTO v_quality FROM public.prospects WHERE id = p_prospect_id;
  IF v_quality IS NOT NULL AND v_quality <> '' AND NOT (v_quality = ANY(v_rules.allowed_quality_labels)) THEN
    RETURN QUERY SELECT false, 'quality_not_allowed', v_score; RETURN;
  END IF;

  SELECT domain INTO v_prospect_domain FROM public.prospects WHERE id = p_prospect_id;
  IF v_rules.required_domain AND (v_prospect_domain IS NULL OR v_prospect_domain = '') THEN
    RETURN QUERY SELECT false, 'no_domain', v_score; RETURN;
  END IF;

  IF v_queue.decision_maker_status IN ('found','revealed') THEN
    RETURN QUERY SELECT false, 'decision_maker_already_found', v_score; RETURN;
  END IF;

  v_credits_used := public.fn_apollo_credits_used_today(p_org);
  IF v_credits_used >= v_rules.max_apollo_credits_per_day THEN
    RETURN QUERY SELECT false, 'daily_credit_limit_reached', v_score; RETURN;
  END IF;

  RETURN QUERY SELECT true, 'eligible'::text, v_score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_apollo_credits_used_today(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_apollo_should_run(uuid, uuid) TO authenticated, service_role;
