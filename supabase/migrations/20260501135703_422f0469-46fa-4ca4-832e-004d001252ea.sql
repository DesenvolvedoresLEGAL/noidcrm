
-- ============================================================
-- Sprint F2.3 — Forecast Engine V2
-- ============================================================

-- 1) Schema additions (idempotent, additive)
ALTER TABLE public.forecast_calculation_items
  ADD COLUMN IF NOT EXISTS next_step_factor numeric NULL;

ALTER TABLE public.forecast_daily_snapshots
  ADD COLUMN IF NOT EXISTS calculation_version text DEFAULT 'forecast_v2_engine_1';

-- Update bucket check constraint to include 'slipping'
ALTER TABLE public.forecast_calculation_items
  DROP CONSTRAINT IF EXISTS fci_bucket_check;
ALTER TABLE public.forecast_calculation_items
  ADD CONSTRAINT fci_bucket_check CHECK (forecast_bucket IN
    ('closed','commit','best_case','realistic','optimistic','pipeline_only','excluded','slipping'));

-- 2) Seed feature flag (default OFF) per organization
INSERT INTO public.feature_flags (organization_id, flag_key, enabled, rollout_metadata)
SELECT id, 'forecast_v2_engine_enabled', false,
       jsonb_build_object('introduced_at', now(), 'sprint', 'F2.3')
FROM public.organizations
ON CONFLICT (organization_id, flag_key) DO NOTHING;

-- ============================================================
-- 3) RPC: calculate_forecast_audit_v2 (rewritten with V2 branch)
-- ============================================================
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
  v_engine_on boolean := false;
  v_calc_version text := 'forecast_v2_audit_1';
  v_total_closed numeric := 0;
  v_total_commit numeric := 0;
  v_total_realistic numeric := 0;
  v_total_optimistic numeric := 0;
  v_total_best_case_bucket numeric := 0;
  v_total_best_case numeric := 0;
  v_pipeline_total numeric := 0;
  v_scen_pess numeric := 0;
  v_scen_real numeric := 0;
  v_scen_opt numeric := 0;
  v_scen_best numeric := 0;
  v_deals_count integer := 0;
  v_included_count integer := 0;
  v_excluded_count integer := 0;
  v_risk_count integer := 0;
  v_slipping_count integer := 0;
  v_nrhs_avg numeric := 0;
  v_quality numeric := 0;
  v_confidence numeric := 100;
  v_days_remaining integer := 0;
  v_eom boolean := false;
  v_open_count integer := 0;
  v_no_act_pct numeric := 0;
  v_no_next_pct numeric := 0;
  v_expired_pct numeric := 0;
  v_high_risk_value_pct numeric := 0;
  v_open_value numeric := 0;
  v_snapshots_count integer := 0;
  v_confidence_reasons jsonb := '[]'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT public.get_user_organization_id() INTO v_caller_org;
  IF v_caller_org IS NULL OR v_caller_org <> p_organization_id THEN
    RAISE EXCEPTION 'organization mismatch';
  END IF;

  -- Feature flag (defaults to false)
  BEGIN
    v_engine_on := COALESCE(public.is_feature_enabled('forecast_v2_engine_enabled'), false);
  EXCEPTION WHEN OTHERS THEN
    v_engine_on := false;
  END;

  IF v_engine_on THEN
    v_calc_version := 'forecast_v2_engine_1';
  END IF;

  v_period_type := CASE
    WHEN (p_period_end - p_period_start) <= 31 THEN 'month'
    WHEN (p_period_end - p_period_start) <= 95 THEN 'quarter'
    ELSE 'custom'
  END;

  v_days_remaining := GREATEST(p_period_end - CURRENT_DATE, 0);
  v_eom := v_days_remaining <= 1;

  INSERT INTO public.forecast_calculation_runs(
    organization_id, pipeline_id, period_start, period_end, period_type,
    seller_id, created_by, status, calculation_version,
    metadata
  ) VALUES (
    p_organization_id, p_pipeline_id, p_period_start, p_period_end, v_period_type,
    p_seller_id, v_caller, 'running', v_calc_version,
    jsonb_build_object('days_remaining', v_days_remaining, 'is_end_of_month_restricted', v_eom)
  ) RETURNING id INTO v_run_id;

  -- ============================================================
  -- BRANCH: V2 ENGINE
  -- ============================================================
  IF v_engine_on THEN

    WITH base AS (
      SELECT
        o.id AS opportunity_id,
        o.owner_user_id AS seller_id,
        o.stage_id,
        s.name AS stage_name,
        UPPER(COALESCE(s.name, '')) AS stage_name_u,
        o.title AS deal_name,
        a.legal_name AS company_name,
        COALESCE(o.valor_previsto, COALESCE(o.mrr_value,0)*12 + COALESCE(o.arr_value,0), 0)::numeric AS deal_value,
        o.prob::numeric AS manual_prob_raw,
        s.probability::numeric AS stage_prob_raw,
        o.nrhs_score::numeric AS nrhs_score,
        o.status AS status,
        o.close_date_prevista::date AS close_date,
        o.closed_at,
        o.last_contact_date,
        o.next_followup_date,
        (o.next_followup_date IS NOT NULL) AS has_next_step
      FROM public.opportunities o
      LEFT JOIN public.stages s ON s.id = o.stage_id
      LEFT JOIN public.accounts a ON a.id = o.account_id
      WHERE o.organization_id = p_organization_id
        AND o.deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id::text)
        AND (p_seller_id IS NULL OR o.owner_user_id = p_seller_id)
        AND (
          (o.status IN ('won','lost') AND o.closed_at::date BETWEEN p_period_start AND p_period_end)
          OR (o.status = 'open')
        )
    ),
    factors AS (
      SELECT b.*,
        -- adjusted_probability (decimal 0..1)
        CASE
          WHEN b.status = 'won' THEN 1.0
          WHEN b.status = 'lost' THEN 0.0
          WHEN b.manual_prob_raw IS NOT NULL AND b.stage_prob_raw IS NOT NULL
            THEN ((COALESCE(b.manual_prob_raw,0) * 0.6 + COALESCE(b.stage_prob_raw,0) * 0.4) / 100.0)
          WHEN b.manual_prob_raw IS NOT NULL THEN (b.manual_prob_raw / 100.0)
          WHEN b.stage_prob_raw IS NOT NULL THEN (b.stage_prob_raw / 100.0)
          ELSE 0.0
        END::numeric AS adj_prob_dec,

        -- nrhs_factor
        CASE
          WHEN b.nrhs_score IS NULL THEN 0.50
          WHEN b.nrhs_score >= 80 THEN 1.00
          WHEN b.nrhs_score >= 70 THEN 0.90
          WHEN b.nrhs_score >= 60 THEN 0.75
          WHEN b.nrhs_score >= 40 THEN 0.50
          ELSE 0.00
        END::numeric AS nrhs_factor,

        -- time_factor
        CASE
          WHEN b.close_date IS NULL THEN 0.00
          WHEN b.close_date BETWEEN p_period_start AND p_period_end THEN 1.00
          WHEN b.close_date < CURRENT_DATE AND (CURRENT_DATE - b.close_date) <= 3 THEN 0.60
          WHEN b.close_date < CURRENT_DATE AND (CURRENT_DATE - b.close_date) <= 7 THEN 0.35
          WHEN b.close_date < CURRENT_DATE THEN 0.10
          WHEN b.close_date > p_period_end AND (b.close_date - p_period_end) <= 15 THEN 0.20
          ELSE 0.05
        END::numeric AS time_factor,

        -- activity_factor (days since last_contact_date)
        CASE
          WHEN b.last_contact_date IS NULL THEN 0.20
          WHEN b.last_contact_date >= now() - interval '2 days' THEN 1.00
          WHEN b.last_contact_date >= now() - interval '7 days' THEN 0.85
          WHEN b.last_contact_date >= now() - interval '14 days' THEN 0.60
          ELSE 0.30
        END::numeric AS activity_factor,

        -- next_step_factor
        CASE WHEN b.has_next_step THEN 1.00 ELSE 0.70 END::numeric AS next_step_factor,

        -- stage_factor
        CASE
          WHEN b.stage_name_u LIKE '%GANH%' THEN 1.00
          WHEN b.stage_name_u LIKE '%PERDID%' THEN 0.00
          WHEN b.stage_name_u LIKE '%PRÉ%APROVA%' OR b.stage_name_u LIKE '%PRE APROVA%' OR b.stage_name_u LIKE '%PRE-APROVA%' THEN 0.90
          WHEN b.stage_name_u LIKE '%PROPOSTA%MESA%' THEN 0.65
          WHEN b.stage_name_u ~ 'FUP[ -]?1\M' THEN 0.75
          WHEN b.stage_name_u ~ 'FUP[ -]?2\M' THEN 0.70
          WHEN b.stage_name_u ~ 'FUP[ -]?3\M' THEN 0.60
          WHEN b.stage_name_u ~ 'FUP[ -]?4\M' THEN 0.50
          WHEN b.stage_name_u ~ 'FUP[ -]?5\M' THEN 0.40
          WHEN b.stage_name_u ~ 'FUP[ -]?6\M' THEN 0.30
          WHEN b.stage_name_u ~ 'FUP[ -]?7\M' THEN 0.20
          WHEN b.stage_name_u LIKE '%+OPP%' OR b.stage_name_u LIKE '%OPP%' THEN 0.40
          ELSE 0.50
        END::numeric AS stage_factor
      FROM base b
    ),
    risk_calc AS (
      SELECT f.*,
        -- preliminary risk_level (used for risk_factor and bucket logic)
        CASE
          WHEN f.status = 'lost' THEN 'critical'
          WHEN f.close_date IS NOT NULL AND f.close_date < CURRENT_DATE
               AND (CURRENT_DATE - f.close_date) > 7 THEN 'critical'
          WHEN COALESCE(f.nrhs_score,0) < 40 AND f.status = 'open' THEN 'high'
          WHEN f.close_date IS NOT NULL AND f.close_date < CURRENT_DATE THEN 'high'
          WHEN COALESCE(f.nrhs_score,0) < 50 THEN 'high'
          WHEN f.activity_factor < 0.60 OR NOT f.has_next_step THEN 'medium'
          ELSE 'low'
        END AS risk_level
      FROM factors f
    ),
    risked AS (
      SELECT r.*,
        CASE r.risk_level
          WHEN 'low' THEN 1.00
          WHEN 'medium' THEN 0.80
          WHEN 'high' THEN 0.55
          WHEN 'critical' THEN 0.25
          ELSE 0.85
        END::numeric AS risk_factor
      FROM risk_calc r
    ),
    classified AS (
      SELECT x.*,
        -- raw bucket (before EOM restriction)
        CASE
          WHEN x.status = 'won' THEN 'closed'
          WHEN x.status = 'lost' THEN 'excluded'
          WHEN COALESCE(x.deal_value,0) <= 0 THEN 'excluded'
          WHEN x.adj_prob_dec <= 0 THEN 'excluded'
          WHEN COALESCE(x.nrhs_score,0) < 40 AND x.nrhs_score IS NOT NULL THEN 'excluded'

          -- slipping conditions
          WHEN x.close_date IS NOT NULL AND x.close_date < CURRENT_DATE THEN 'slipping'
          WHEN x.close_date IS NOT NULL AND x.close_date NOT BETWEEN p_period_start AND p_period_end
               AND x.close_date > p_period_end THEN 'slipping'

          -- commit
          WHEN x.adj_prob_dec >= 0.70
               AND COALESCE(x.nrhs_score,0) >= 70
               AND x.close_date IS NOT NULL AND x.close_date BETWEEN p_period_start AND p_period_end
               AND x.activity_factor >= 0.85  -- last 7 days
               AND x.has_next_step
               AND x.risk_level <> 'critical'
            THEN 'commit'

          -- realistic
          WHEN x.adj_prob_dec >= 0.50
               AND COALESCE(x.nrhs_score,0) >= 60
               AND x.close_date IS NOT NULL AND x.close_date BETWEEN p_period_start AND p_period_end
               AND x.time_factor >= 0.60
               AND x.activity_factor >= 0.60
               AND x.risk_factor >= 0.55
            THEN 'realistic'

          -- optimistic
          WHEN x.adj_prob_dec >= 0.25
               AND COALESCE(x.nrhs_score,0) >= 50
               AND COALESCE(x.deal_value,0) > 0
            THEN 'optimistic'

          -- best_case
          WHEN COALESCE(x.deal_value,0) > 0
               AND (COALESCE(x.nrhs_score,0) >= 40 OR x.nrhs_score IS NULL)
               AND x.adj_prob_dec > 0
            THEN 'best_case'

          ELSE 'pipeline_only'
        END AS raw_bucket
      FROM risked x
    ),
    eom_applied AS (
      SELECT c.*,
        -- end-of-month tightening
        CASE
          WHEN v_eom AND c.raw_bucket IN ('commit','realistic')
               AND NOT (
                 c.close_date IS NOT NULL AND c.close_date BETWEEN p_period_start AND p_period_end
                 AND c.activity_factor >= 1.00  -- ≤ 2 days
                 AND c.adj_prob_dec >= 0.70
                 AND COALESCE(c.nrhs_score,0) >= 70
                 AND c.has_next_step
                 AND c.risk_level NOT IN ('high','critical')
               )
            THEN 'slipping'
          ELSE c.raw_bucket
        END AS bucket,
        (v_eom AND c.raw_bucket IN ('commit','realistic')
          AND NOT (
            c.close_date IS NOT NULL AND c.close_date BETWEEN p_period_start AND p_period_end
            AND c.activity_factor >= 1.00
            AND c.adj_prob_dec >= 0.70
            AND COALESCE(c.nrhs_score,0) >= 70
            AND c.has_next_step
            AND c.risk_level NOT IN ('high','critical')
          )) AS eom_restricted
      FROM classified c
    ),
    final AS (
      SELECT e.*,
        -- exclusion reasons
        ARRAY_REMOVE(ARRAY[
          CASE WHEN e.status = 'lost' THEN 'lost_opportunity' END,
          CASE WHEN COALESCE(e.deal_value,0) <= 0 THEN 'missing_deal_value' END,
          CASE WHEN e.adj_prob_dec <= 0 AND e.status <> 'won' THEN 'zero_probability' END,
          CASE WHEN e.nrhs_score IS NOT NULL AND e.nrhs_score < 40 THEN 'nrhs_below_40' END,
          CASE WHEN e.close_date IS NULL AND e.bucket = 'excluded' THEN 'missing_close_date' END
        ]::text[], NULL) AS exclusion_reasons,
        -- penalty reasons
        ARRAY_REMOVE(ARRAY[
          CASE WHEN e.activity_factor <= 0.30 THEN 'stale_activity' END,
          CASE WHEN NOT e.has_next_step THEN 'missing_next_step' END,
          CASE WHEN e.close_date IS NOT NULL AND e.close_date < CURRENT_DATE THEN 'expired_close_date' END,
          CASE WHEN e.risk_level = 'high' THEN 'high_risk' END,
          CASE WHEN e.risk_level = 'critical' THEN 'critical_risk' END,
          CASE WHEN e.eom_restricted THEN 'end_of_month_restriction' END,
          CASE WHEN e.close_date IS NOT NULL AND e.close_date NOT BETWEEN p_period_start AND p_period_end
               AND e.close_date >= CURRENT_DATE THEN 'close_date_outside_period' END,
          CASE WHEN e.nrhs_score IS NOT NULL AND e.nrhs_score < 60 AND e.nrhs_score >= 40 THEN 'low_nrhs' END,
          CASE WHEN e.stage_factor <= 0.40 THEN 'weak_stage' END
        ]::text[], NULL) AS penalty_reasons,
        -- adjusted_value (only meaningful for open buckets)
        CASE
          WHEN e.bucket = 'closed' THEN e.deal_value
          WHEN e.bucket = 'excluded' THEN 0
          ELSE ROUND(
            (e.deal_value
              * e.adj_prob_dec
              * e.nrhs_factor
              * e.time_factor
              * e.activity_factor
              * e.next_step_factor
              * e.stage_factor
              * e.risk_factor)::numeric
          , 2)
        END::numeric AS adjusted_value
      FROM eom_applied e
    )
    INSERT INTO public.forecast_calculation_items(
      run_id, organization_id, opportunity_id, seller_id, stage_id,
      deal_name, company_name, deal_value,
      manual_probability, stage_probability, adjusted_probability,
      nrhs_score, nrhs_factor, time_factor, activity_factor, next_step_factor,
      stage_factor, risk_factor, adjusted_value,
      forecast_bucket, eligibility_status, risk_level,
      close_date, last_activity_at, next_step_exists,
      exclusion_reasons, penalty_reasons,
      metadata
    )
    SELECT
      v_run_id, p_organization_id, f.opportunity_id, f.seller_id, f.stage_id,
      f.deal_name, f.company_name, f.deal_value,
      f.manual_prob_raw, f.stage_prob_raw,
      ROUND((f.adj_prob_dec * 100)::numeric, 2),
      f.nrhs_score, f.nrhs_factor, f.time_factor, f.activity_factor, f.next_step_factor,
      f.stage_factor, f.risk_factor, f.adjusted_value,
      f.bucket,
      CASE
        WHEN f.bucket = 'excluded' THEN 'excluded'
        WHEN f.bucket = 'slipping' THEN 'slipping'
        WHEN array_length(f.penalty_reasons, 1) > 0 AND f.bucket NOT IN ('closed') THEN 'penalized'
        ELSE 'included'
      END,
      f.risk_level,
      f.close_date, f.last_contact_date, f.has_next_step,
      f.exclusion_reasons, f.penalty_reasons,
      jsonb_build_object(
        'formula', 'deal_value * adjusted_probability * nrhs_factor * time_factor * activity_factor * next_step_factor * stage_factor * risk_factor',
        'days_remaining', v_days_remaining,
        'is_end_of_month_restricted', f.eom_restricted,
        'raw_value', f.deal_value,
        'adjusted_value', f.adjusted_value,
        'factors', jsonb_build_object(
          'adjusted_probability', f.adj_prob_dec,
          'nrhs_factor', f.nrhs_factor,
          'time_factor', f.time_factor,
          'activity_factor', f.activity_factor,
          'next_step_factor', f.next_step_factor,
          'stage_factor', f.stage_factor,
          'risk_factor', f.risk_factor
        )
      )
    FROM final f;

    -- Aggregate totals (V2)
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE eligibility_status IN ('included','penalized','slipping')),
      COUNT(*) FILTER (WHERE eligibility_status = 'excluded'),
      COUNT(*) FILTER (WHERE risk_level IN ('high','critical')),
      COUNT(*) FILTER (WHERE forecast_bucket = 'slipping'),
      COALESCE(SUM(deal_value) FILTER (WHERE forecast_bucket = 'closed'), 0),
      COALESCE(SUM(adjusted_value) FILTER (WHERE forecast_bucket = 'commit'), 0),
      COALESCE(SUM(adjusted_value) FILTER (WHERE forecast_bucket = 'realistic'), 0),
      COALESCE(SUM(adjusted_value) FILTER (WHERE forecast_bucket = 'optimistic'), 0),
      COALESCE(SUM(deal_value) FILTER (WHERE forecast_bucket = 'best_case'), 0),
      COALESCE(SUM(deal_value) FILTER (WHERE forecast_bucket NOT IN ('excluded')), 0),
      COALESCE(AVG(nrhs_score) FILTER (WHERE nrhs_score IS NOT NULL), 0)
    INTO
      v_deals_count, v_included_count, v_excluded_count, v_risk_count, v_slipping_count,
      v_total_closed, v_total_commit, v_total_realistic, v_total_optimistic,
      v_total_best_case_bucket, v_pipeline_total, v_nrhs_avg
    FROM public.forecast_calculation_items
    WHERE run_id = v_run_id;

    -- Scenarios per spec (V2)
    v_scen_pess := v_total_closed;
    v_scen_real := v_total_closed + v_total_commit + v_total_realistic;
    v_scen_opt  := v_total_closed + v_total_commit + v_total_realistic + v_total_optimistic;
    v_total_commit := v_total_closed + v_total_commit;  -- as per spec totals

    -- Best case = closed + sum(deal_value) of commit/realistic/optimistic/best_case buckets
    SELECT v_total_closed
      + COALESCE(SUM(deal_value) FILTER (WHERE forecast_bucket IN ('commit','realistic','optimistic','best_case')), 0)
    INTO v_scen_best
    FROM public.forecast_calculation_items
    WHERE run_id = v_run_id;
    v_total_best_case := v_scen_best;

    -- Data quality
    IF v_deals_count > 0 THEN
      v_quality := ROUND((v_included_count::numeric / v_deals_count::numeric) * 100, 2);
    END IF;

    -- Confidence (objective penalties from base 100)
    v_confidence := 100;
    v_confidence_reasons := '[]'::jsonb;

    SELECT COUNT(*) INTO v_open_count
    FROM public.forecast_calculation_items
    WHERE run_id = v_run_id AND forecast_bucket NOT IN ('closed','excluded');

    IF v_open_count > 0 THEN
      SELECT COALESCE(SUM(deal_value),0) INTO v_open_value
      FROM public.forecast_calculation_items
      WHERE run_id = v_run_id AND forecast_bucket NOT IN ('closed','excluded');

      SELECT
        ROUND(100.0 * COUNT(*) FILTER (WHERE last_activity_at IS NULL OR last_activity_at < now() - interval '14 days')::numeric / NULLIF(v_open_count,0), 2),
        ROUND(100.0 * COUNT(*) FILTER (WHERE NOT COALESCE(next_step_exists,false))::numeric / NULLIF(v_open_count,0), 2),
        ROUND(100.0 * COUNT(*) FILTER (WHERE close_date IS NOT NULL AND close_date < CURRENT_DATE)::numeric / NULLIF(v_open_count,0), 2),
        ROUND(100.0 * COALESCE(SUM(deal_value) FILTER (WHERE risk_level IN ('high','critical')),0) / NULLIF(v_open_value,0), 2)
      INTO v_no_act_pct, v_no_next_pct, v_expired_pct, v_high_risk_value_pct
      FROM public.forecast_calculation_items
      WHERE run_id = v_run_id AND forecast_bucket NOT IN ('closed','excluded');
    END IF;

    SELECT COUNT(*) INTO v_snapshots_count
    FROM public.forecast_daily_snapshots
    WHERE organization_id = p_organization_id
      AND COALESCE(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_seller_id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_snapshots_count < 5 THEN
      v_confidence := v_confidence - 10;
      v_confidence_reasons := v_confidence_reasons || to_jsonb('Pouco histórico de snapshots ('||v_snapshots_count||') para medir acurácia');
    END IF;
    IF v_no_act_pct > 30 THEN
      v_confidence := v_confidence - 20;
      v_confidence_reasons := v_confidence_reasons || to_jsonb(ROUND(v_no_act_pct,0)||'% dos deals abertos sem atividade recente');
    END IF;
    IF v_no_next_pct > 20 THEN
      v_confidence := v_confidence - 15;
      v_confidence_reasons := v_confidence_reasons || to_jsonb(ROUND(v_no_next_pct,0)||'% dos deals abertos sem próximo passo');
    END IF;
    IF v_expired_pct > 10 THEN
      v_confidence := v_confidence - 15;
      v_confidence_reasons := v_confidence_reasons || to_jsonb(ROUND(v_expired_pct,0)||'% dos deals com close date vencida');
    END IF;
    IF v_high_risk_value_pct > 20 THEN
      v_confidence := v_confidence - 15;
      v_confidence_reasons := v_confidence_reasons || to_jsonb(ROUND(v_high_risk_value_pct,0)||'% do valor aberto em risco alto/crítico');
    END IF;
    IF v_nrhs_avg > 0 AND v_nrhs_avg < 60 THEN
      v_confidence := v_confidence - 15;
      v_confidence_reasons := v_confidence_reasons || to_jsonb('NRHS médio baixo ('||ROUND(v_nrhs_avg,0)||')');
    END IF;
    IF v_quality < 70 THEN
      v_confidence := v_confidence - 10;
      v_confidence_reasons := v_confidence_reasons || to_jsonb('Qualidade dos dados baixa ('||ROUND(v_quality,0)||'%)');
    END IF;
    IF v_eom AND v_open_value > 0 THEN
      v_confidence := v_confidence - 10;
      v_confidence_reasons := v_confidence_reasons || to_jsonb('Fim de período com pipeline aberto ainda não fechado');
    END IF;

    v_confidence := GREATEST(0, LEAST(100, v_confidence));

  ELSE
    -- ============================================================
    -- BRANCH: LEGACY (preserves prior behavior)
    -- ============================================================
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
  END IF;

  -- ============================================================
  -- Persist run summary (both branches)
  -- ============================================================
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
    slipping_deals_count = v_slipping_count,
    metadata = COALESCE(metadata,'{}'::jsonb)
      || jsonb_build_object(
        'days_remaining', v_days_remaining,
        'is_end_of_month_restricted', v_eom,
        'confidence_reasons', v_confidence_reasons,
        'engine_on', v_engine_on
      )
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'calculation_version', v_calc_version,
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
    'slipping_deals_count', v_slipping_count,
    'days_remaining', v_days_remaining,
    'is_end_of_month_restricted', v_eom,
    'confidence_reasons', v_confidence_reasons
  );

EXCEPTION WHEN OTHERS THEN
  IF v_run_id IS NOT NULL THEN
    UPDATE public.forecast_calculation_runs
       SET status = 'failed', metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('error', SQLERRM)
     WHERE id = v_run_id;
  END IF;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_forecast_audit_v2(uuid, uuid, date, date, uuid) TO authenticated;

-- ============================================================
-- 4) Update create_forecast_daily_snapshot_v2 to copy calculation_version
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_forecast_daily_snapshot_v2(
  p_organization_id uuid,
  p_pipeline_id uuid,
  p_period_start date,
  p_period_end date,
  p_seller_id uuid DEFAULT NULL,
  p_snapshot_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_audit_result jsonb;
  v_run_id uuid;
  v_run record;
  v_no_recent integer := 0;
  v_no_next integer := 0;
  v_expired integer := 0;
  v_low_nrhs integer := 0;
  v_snapshot_id uuid;
  v_snapshot record;
BEGIN
  IF v_caller IS NOT NULL THEN
    SELECT public.get_user_organization_id() INTO v_caller_org;
    IF v_caller_org IS DISTINCT FROM p_organization_id
       AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
      RAISE EXCEPTION 'forbidden: organization mismatch';
    END IF;
  END IF;

  v_audit_result := public.calculate_forecast_audit_v2(
    p_organization_id, p_pipeline_id, p_period_start, p_period_end, p_seller_id
  );

  v_run_id := NULLIF(v_audit_result->>'run_id', '')::uuid;
  IF v_run_id IS NULL THEN
    RAISE EXCEPTION 'forecast audit did not return a run_id';
  END IF;

  SELECT * INTO v_run FROM public.forecast_calculation_runs WHERE id = v_run_id;

  SELECT
    COUNT(*) FILTER (WHERE last_activity_at IS NULL OR last_activity_at < (now() - interval '7 days')),
    COUNT(*) FILTER (WHERE COALESCE(next_step_exists, false) = false),
    COUNT(*) FILTER (WHERE close_date IS NOT NULL AND close_date < current_date AND eligibility_status <> 'excluded'),
    COUNT(*) FILTER (WHERE COALESCE(nrhs_score, 0) < 60)
  INTO v_no_recent, v_no_next, v_expired, v_low_nrhs
  FROM public.forecast_calculation_items
  WHERE run_id = v_run_id;

  INSERT INTO public.forecast_daily_snapshots (
    organization_id, pipeline_id, snapshot_date,
    period_start, period_end, period_type,
    seller_id, run_id, calculation_version,
    monthly_goal,
    closed_amount, commit_amount, best_case_amount,
    scenario_pessimistic, scenario_realistic, scenario_optimistic, scenario_best_case,
    pipeline_total,
    forecast_confidence, nrhs_avg, data_quality_score,
    deals_count, included_deals_count, excluded_deals_count, risk_deals_count, slipping_deals_count,
    no_recent_activity_count, no_next_step_count, expired_close_date_count, low_nrhs_count,
    metadata
  ) VALUES (
    p_organization_id, p_pipeline_id, p_snapshot_date,
    p_period_start, p_period_end, COALESCE(v_run.period_type, 'monthly'),
    p_seller_id, v_run_id, COALESCE(v_run.calculation_version, 'forecast_v2_engine_1'),
    0,
    COALESCE(v_run.total_closed, 0), COALESCE(v_run.total_commit, 0), COALESCE(v_run.total_best_case, 0),
    COALESCE(v_run.scenario_pessimistic, 0), COALESCE(v_run.scenario_realistic, 0),
    COALESCE(v_run.scenario_optimistic, 0), COALESCE(v_run.scenario_best_case, 0),
    COALESCE(v_run.pipeline_total, 0),
    COALESCE(v_run.forecast_confidence, 0), COALESCE(v_run.nrhs_avg, 0), COALESCE(v_run.data_quality_score, 0),
    COALESCE(v_run.deals_count, 0), COALESCE(v_run.included_deals_count, 0),
    COALESCE(v_run.excluded_deals_count, 0), COALESCE(v_run.risk_deals_count, 0),
    COALESCE(v_run.slipping_deals_count, 0),
    v_no_recent, v_no_next, v_expired, v_low_nrhs,
    jsonb_build_object('source', 'create_forecast_daily_snapshot_v2', 'calculation_version', v_run.calculation_version)
  )
  ON CONFLICT (
    organization_id,
    COALESCE(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid),
    snapshot_date,
    period_start,
    period_end,
    COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  DO UPDATE SET
    run_id = EXCLUDED.run_id,
    calculation_version = EXCLUDED.calculation_version,
    closed_amount = EXCLUDED.closed_amount,
    commit_amount = EXCLUDED.commit_amount,
    best_case_amount = EXCLUDED.best_case_amount,
    scenario_pessimistic = EXCLUDED.scenario_pessimistic,
    scenario_realistic = EXCLUDED.scenario_realistic,
    scenario_optimistic = EXCLUDED.scenario_optimistic,
    scenario_best_case = EXCLUDED.scenario_best_case,
    pipeline_total = EXCLUDED.pipeline_total,
    forecast_confidence = EXCLUDED.forecast_confidence,
    nrhs_avg = EXCLUDED.nrhs_avg,
    data_quality_score = EXCLUDED.data_quality_score,
    deals_count = EXCLUDED.deals_count,
    included_deals_count = EXCLUDED.included_deals_count,
    excluded_deals_count = EXCLUDED.excluded_deals_count,
    risk_deals_count = EXCLUDED.risk_deals_count,
    slipping_deals_count = EXCLUDED.slipping_deals_count,
    no_recent_activity_count = EXCLUDED.no_recent_activity_count,
    no_next_step_count = EXCLUDED.no_next_step_count,
    expired_close_date_count = EXCLUDED.expired_close_date_count,
    low_nrhs_count = EXCLUDED.low_nrhs_count,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING id INTO v_snapshot_id;

  SELECT * INTO v_snapshot FROM public.forecast_daily_snapshots WHERE id = v_snapshot_id;
  RETURN to_jsonb(v_snapshot);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_forecast_daily_snapshot_v2(uuid, uuid, date, date, uuid, date) TO authenticated, service_role;
