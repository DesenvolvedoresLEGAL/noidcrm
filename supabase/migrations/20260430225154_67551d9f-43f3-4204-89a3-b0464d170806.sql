
CREATE TABLE IF NOT EXISTS public.forecast_calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pipeline_id uuid NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL,
  seller_id uuid NULL,
  created_by uuid NULL,
  calculation_version text NOT NULL DEFAULT 'forecast_v2_audit_1',
  status text NOT NULL DEFAULT 'completed',
  total_closed numeric DEFAULT 0,
  total_commit numeric DEFAULT 0,
  total_best_case numeric DEFAULT 0,
  scenario_pessimistic numeric DEFAULT 0,
  scenario_realistic numeric DEFAULT 0,
  scenario_optimistic numeric DEFAULT 0,
  scenario_best_case numeric DEFAULT 0,
  forecast_confidence numeric DEFAULT 0,
  nrhs_avg numeric DEFAULT 0,
  data_quality_score numeric DEFAULT 0,
  pipeline_total numeric DEFAULT 0,
  deals_count integer DEFAULT 0,
  included_deals_count integer DEFAULT 0,
  excluded_deals_count integer DEFAULT 0,
  risk_deals_count integer DEFAULT 0,
  slipping_deals_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcr_org_created
  ON public.forecast_calculation_runs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fcr_org_period
  ON public.forecast_calculation_runs (organization_id, pipeline_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS public.forecast_calculation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.forecast_calculation_runs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  seller_id uuid NULL,
  stage_id text NULL,
  deal_name text NULL,
  company_name text NULL,
  deal_value numeric DEFAULT 0,
  manual_probability numeric NULL,
  stage_probability numeric NULL,
  adjusted_probability numeric NULL,
  nrhs_score numeric NULL,
  nrhs_factor numeric NULL,
  time_factor numeric NULL,
  activity_factor numeric NULL,
  stage_factor numeric NULL,
  risk_factor numeric NULL,
  adjusted_value numeric DEFAULT 0,
  forecast_bucket text NOT NULL,
  eligibility_status text NOT NULL,
  risk_level text NULL,
  close_date date NULL,
  last_activity_at timestamptz NULL,
  next_step_exists boolean DEFAULT false,
  exclusion_reasons text[] DEFAULT '{}'::text[],
  penalty_reasons text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fci_bucket_check CHECK (forecast_bucket IN
    ('closed','commit','best_case','realistic','optimistic','pipeline_only','excluded')),
  CONSTRAINT fci_eligibility_check CHECK (eligibility_status IN
    ('included','penalized','excluded','slipping'))
);

CREATE INDEX IF NOT EXISTS idx_fci_run ON public.forecast_calculation_items (run_id);
CREATE INDEX IF NOT EXISTS idx_fci_org_opp ON public.forecast_calculation_items (organization_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_fci_run_bucket ON public.forecast_calculation_items (run_id, forecast_bucket);
CREATE INDEX IF NOT EXISTS idx_fci_run_eligibility ON public.forecast_calculation_items (run_id, eligibility_status);

ALTER TABLE public.forecast_calculation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_calculation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcr_select" ON public.forecast_calculation_runs;
CREATE POLICY "fcr_select" ON public.forecast_calculation_runs
FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_org_admin(organization_id, auth.uid())
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR seller_id IS NULL
    OR seller_id = auth.uid()
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "fci_select" ON public.forecast_calculation_items;
CREATE POLICY "fci_select" ON public.forecast_calculation_items
FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_org_admin(organization_id, auth.uid())
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR seller_id IS NULL
    OR seller_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.calculate_forecast_audit_v2(
  p_organization_id uuid,
  p_pipeline_id uuid,
  p_period_start date,
  p_period_end date,
  p_seller_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_period_type text;
  v_total_closed numeric := 0;
  v_total_commit numeric := 0;
  v_total_realistic numeric := 0;
  v_total_optimistic numeric := 0;
  v_total_best_case numeric := 0;
  v_pipeline_total numeric := 0;
  v_scen_pess numeric;
  v_scen_real numeric;
  v_scen_opt numeric;
  v_scen_best numeric;
  v_deals_count integer := 0;
  v_included_count integer := 0;
  v_excluded_count integer := 0;
  v_risk_count integer := 0;
  v_slipping_count integer := 0;
  v_nrhs_avg numeric := 0;
  v_quality numeric := 0;
  v_confidence numeric := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT public.get_user_organization_id() INTO v_caller_org;
  IF v_caller_org IS NULL OR v_caller_org <> p_organization_id THEN
    RAISE EXCEPTION 'organization mismatch';
  END IF;

  v_period_type := CASE
    WHEN (p_period_end - p_period_start) <= 31 THEN 'month'
    WHEN (p_period_end - p_period_start) <= 95 THEN 'quarter'
    ELSE 'custom'
  END;

  INSERT INTO public.forecast_calculation_runs(
    organization_id, pipeline_id, period_start, period_end, period_type,
    seller_id, created_by, status
  ) VALUES (
    p_organization_id, p_pipeline_id, p_period_start, p_period_end, v_period_type,
    p_seller_id, v_caller, 'running'
  ) RETURNING id INTO v_run_id;

  WITH base AS (
    SELECT
      o.id AS opportunity_id,
      o.owner_user_id AS seller_id,
      o.stage_id,
      o.title AS deal_name,
      a.legal_name AS company_name,
      COALESCE(o.valor_previsto, COALESCE(o.mrr_value,0)*12 + COALESCE(o.arr_value,0), 0)::numeric AS deal_value,
      o.prob::numeric AS manual_probability,
      s.probability::numeric AS stage_probability,
      COALESCE(o.prob, s.probability, 0)::numeric AS effective_prob,
      o.nrhs_score::numeric AS nrhs_score,
      o.status AS status,
      o.close_date_prevista::date AS close_date,
      o.closed_at,
      o.last_contact_date,
      o.next_followup_date,
      (o.last_contact_date IS NOT NULL AND o.last_contact_date >= now() - interval '14 days') AS has_recent_activity,
      (o.next_followup_date IS NOT NULL) AS has_next_step,
      (o.close_date_prevista IS NOT NULL
        AND o.close_date_prevista::date < CURRENT_DATE
        AND o.status = 'open') AS is_slipping
    FROM public.opportunities o
    LEFT JOIN public.stages s ON s.id = o.stage_id
    LEFT JOIN public.accounts a ON a.id = o.account_id
    WHERE o.organization_id = p_organization_id
      AND o.deleted_at IS NULL
      AND (p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id::text)
      AND (p_seller_id IS NULL OR o.owner_user_id = p_seller_id)
      AND (
        (o.status IN ('won','lost') AND o.closed_at::date BETWEEN p_period_start AND p_period_end)
        OR (o.status = 'open' AND (
          o.close_date_prevista IS NULL
          OR o.close_date_prevista::date BETWEEN p_period_start AND p_period_end
          OR o.close_date_prevista::date < CURRENT_DATE
        ))
      )
  ),
  classified AS (
    SELECT b.*,
      LEAST(GREATEST(COALESCE(b.nrhs_score,0)/100.0, 0), 1.2)::numeric AS nrhs_factor,
      CASE
        WHEN b.close_date IS NULL THEN 0.85
        WHEN b.close_date < CURRENT_DATE THEN 0.6
        WHEN b.close_date <= p_period_end THEN 1.0
        ELSE 0.9
      END::numeric AS time_factor,
      CASE
        WHEN b.has_recent_activity AND b.has_next_step THEN 1.0
        WHEN b.has_recent_activity OR b.has_next_step THEN 0.85
        ELSE 0.7
      END::numeric AS activity_factor,
      CASE
        WHEN b.status = 'won' THEN 'closed'
        WHEN COALESCE(b.deal_value,0) <= 0 THEN 'excluded'
        WHEN b.effective_prob IS NULL OR b.effective_prob = 0 THEN 'excluded'
        WHEN COALESCE(b.nrhs_score, 0) < 40 THEN 'excluded'
        WHEN b.status = 'lost' THEN 'excluded'
        WHEN b.is_slipping AND b.effective_prob >= 70 THEN 'commit'
        WHEN b.is_slipping THEN 'realistic'
        WHEN b.effective_prob >= 70 AND COALESCE(b.nrhs_score,0) >= 70
             AND b.close_date IS NOT NULL AND b.close_date BETWEEN p_period_start AND p_period_end
             AND b.has_recent_activity AND b.has_next_step THEN 'commit'
        WHEN b.effective_prob >= 50 AND COALESCE(b.nrhs_score,0) >= 60
             AND b.close_date IS NOT NULL AND b.close_date BETWEEN p_period_start AND p_period_end THEN 'realistic'
        WHEN b.effective_prob >= 25 AND COALESCE(b.nrhs_score,0) >= 50 AND b.status = 'open' THEN 'optimistic'
        ELSE 'pipeline_only'
      END AS bucket
    FROM base b
  ),
  enriched AS (
    SELECT c.*,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN COALESCE(c.deal_value,0) <= 0 THEN 'no_value' END,
        CASE WHEN c.effective_prob IS NULL OR c.effective_prob = 0 THEN 'no_probability' END,
        CASE WHEN COALESCE(c.nrhs_score,0) < 40 THEN 'low_nrhs' END,
        CASE WHEN c.status = 'lost' THEN 'lost' END
      ]::text[], NULL) AS exclusion_reasons,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN c.is_slipping THEN 'slipping_close_date' END,
        CASE WHEN NOT c.has_recent_activity THEN 'no_recent_activity' END,
        CASE WHEN NOT c.has_next_step THEN 'no_next_step' END,
        CASE WHEN c.close_date IS NULL THEN 'missing_close_date' END
      ]::text[], NULL) AS penalty_reasons,
      LEAST(100,
        c.effective_prob *
        LEAST(GREATEST(COALESCE(c.nrhs_score,0)/100.0, 0), 1.2) *
        (CASE WHEN c.close_date IS NULL THEN 0.85
              WHEN c.close_date < CURRENT_DATE THEN 0.6
              WHEN c.close_date <= p_period_end THEN 1.0
              ELSE 0.9 END) *
        (CASE WHEN c.has_recent_activity AND c.has_next_step THEN 1.0
              WHEN c.has_recent_activity OR c.has_next_step THEN 0.85
              ELSE 0.7 END)
      )::numeric AS adjusted_prob
    FROM classified c
  ),
  final AS (
    SELECT e.*,
      CASE
        WHEN e.bucket = 'excluded' THEN 'excluded'
        WHEN e.is_slipping THEN 'slipping'
        WHEN array_length(e.penalty_reasons,1) > 0 AND e.bucket NOT IN ('closed','pipeline_only') THEN 'penalized'
        ELSE 'included'
      END AS eligibility,
      CASE
        WHEN e.is_slipping OR COALESCE(e.nrhs_score,0) < 50 THEN 'high'
        WHEN NOT e.has_recent_activity OR NOT e.has_next_step THEN 'medium'
        ELSE 'low'
      END AS risk_level,
      (e.deal_value * (LEAST(100,
        e.effective_prob *
        LEAST(GREATEST(COALESCE(e.nrhs_score,0)/100.0, 0), 1.2) *
        (CASE WHEN e.close_date IS NULL THEN 0.85
              WHEN e.close_date < CURRENT_DATE THEN 0.6
              WHEN e.close_date <= p_period_end THEN 1.0
              ELSE 0.9 END) *
        (CASE WHEN e.has_recent_activity AND e.has_next_step THEN 1.0
              WHEN e.has_recent_activity OR e.has_next_step THEN 0.85
              ELSE 0.7 END)
      )) / 100.0)::numeric AS adjusted_value
    FROM enriched e
  )
  INSERT INTO public.forecast_calculation_items(
    run_id, organization_id, opportunity_id, seller_id, stage_id,
    deal_name, company_name, deal_value,
    manual_probability, stage_probability, adjusted_probability,
    nrhs_score, nrhs_factor, time_factor, activity_factor,
    stage_factor, risk_factor, adjusted_value,
    forecast_bucket, eligibility_status, risk_level,
    close_date, last_activity_at, next_step_exists,
    exclusion_reasons, penalty_reasons
  )
  SELECT
    v_run_id, p_organization_id, f.opportunity_id, f.seller_id, f.stage_id,
    f.deal_name, f.company_name, f.deal_value,
    f.manual_probability, f.stage_probability, f.adjusted_prob,
    f.nrhs_score, f.nrhs_factor, f.time_factor, f.activity_factor,
    NULL, NULL, f.adjusted_value,
    f.bucket, f.eligibility, f.risk_level,
    f.close_date, f.last_contact_date, f.has_next_step,
    f.exclusion_reasons, f.penalty_reasons
  FROM final f;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE eligibility_status IN ('included','penalized','slipping')),
    COUNT(*) FILTER (WHERE eligibility_status = 'excluded'),
    COUNT(*) FILTER (WHERE risk_level = 'high'),
    COUNT(*) FILTER (WHERE eligibility_status = 'slipping'),
    COALESCE(SUM(deal_value) FILTER (WHERE forecast_bucket = 'closed'), 0),
    COALESCE(SUM(adjusted_value) FILTER (WHERE forecast_bucket = 'commit'), 0),
    COALESCE(SUM(adjusted_value) FILTER (WHERE forecast_bucket = 'realistic'), 0),
    COALESCE(SUM(adjusted_value) FILTER (WHERE forecast_bucket = 'optimistic'), 0),
    COALESCE(SUM(deal_value) FILTER (WHERE forecast_bucket NOT IN ('excluded')), 0),
    COALESCE(AVG(nrhs_score) FILTER (WHERE nrhs_score IS NOT NULL), 0)
  INTO
    v_deals_count, v_included_count, v_excluded_count, v_risk_count, v_slipping_count,
    v_total_closed, v_total_commit, v_total_realistic, v_total_optimistic,
    v_pipeline_total, v_nrhs_avg
  FROM public.forecast_calculation_items
  WHERE run_id = v_run_id;

  v_scen_pess := v_total_closed + v_total_commit * 0.7;
  v_scen_real := v_total_closed + v_total_commit + v_total_realistic * 0.5;
  v_scen_opt  := v_total_closed + v_total_commit + v_total_realistic + v_total_optimistic * 0.5;
  v_scen_best := v_total_closed + v_total_commit + v_total_realistic + v_total_optimistic;
  v_total_best_case := v_scen_best;

  IF v_deals_count > 0 THEN
    v_quality := ROUND((v_included_count::numeric / v_deals_count::numeric) * 100, 2);
  END IF;
  v_confidence := LEAST(100, ROUND((v_nrhs_avg * 0.6 + v_quality * 0.4)::numeric, 2));

  UPDATE public.forecast_calculation_runs SET
    status = 'completed',
    total_closed = v_total_closed,
    total_commit = v_total_commit,
    total_best_case = v_total_best_case,
    scenario_pessimistic = v_scen_pess,
    scenario_realistic = v_scen_real,
    scenario_optimistic = v_scen_opt,
    scenario_best_case = v_scen_best,
    forecast_confidence = v_confidence,
    nrhs_avg = ROUND(v_nrhs_avg, 2),
    data_quality_score = v_quality,
    pipeline_total = v_pipeline_total,
    deals_count = v_deals_count,
    included_deals_count = v_included_count,
    excluded_deals_count = v_excluded_count,
    risk_deals_count = v_risk_count,
    slipping_deals_count = v_slipping_count
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'total_closed', v_total_closed,
    'total_commit', v_total_commit,
    'total_best_case', v_total_best_case,
    'scenario_pessimistic', v_scen_pess,
    'scenario_realistic', v_scen_real,
    'scenario_optimistic', v_scen_opt,
    'scenario_best_case', v_scen_best,
    'forecast_confidence', v_confidence,
    'nrhs_avg', v_nrhs_avg,
    'data_quality_score', v_quality,
    'deals_count', v_deals_count,
    'included_deals_count', v_included_count,
    'excluded_deals_count', v_excluded_count,
    'risk_deals_count', v_risk_count,
    'slipping_deals_count', v_slipping_count
  );

EXCEPTION WHEN OTHERS THEN
  IF v_run_id IS NOT NULL THEN
    UPDATE public.forecast_calculation_runs
       SET status = 'failed', metadata = jsonb_build_object('error', SQLERRM)
     WHERE id = v_run_id;
  END IF;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_forecast_audit_v2(uuid, uuid, date, date, uuid) TO authenticated;
