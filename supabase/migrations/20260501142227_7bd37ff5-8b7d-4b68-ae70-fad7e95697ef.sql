-- F2.6 HUMANOID Forecast Intelligence V2
CREATE OR REPLACE FUNCTION public.get_forecast_intelligence_v2(
  p_organization_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_is_platform boolean := false;
  v_can_view_all boolean := false;
  v_seller_filter uuid;

  v_run record;
  v_calc_version text := 'forecast_v2_engine_1';

  v_monthly_goal numeric;
  v_closed numeric := 0;
  v_realistic numeric := 0;
  v_optimistic numeric := 0;
  v_best_case numeric := 0;
  v_pessimistic numeric := 0;
  v_pipeline_total numeric := 0;
  v_deals_count int := 0;
  v_included int := 0;

  v_with_next int := 0;
  v_with_activity int := 0;

  v_contaminated_amount numeric := 0;
  v_contaminated_count int := 0;
  v_stale_amount numeric := 0;
  v_no_next_amount numeric := 0;
  v_expired_amount numeric := 0;

  v_snapshots_count int := 0;
  v_accuracy_score numeric;
  v_bias_direction text := 'unknown';
  v_forecast_trend text := 'unknown';
  v_avg_realistic_error numeric;

  v_confidence_score numeric := 0;
  v_confidence_level text := 'critical';
  v_confidence_reasons jsonb := '[]'::jsonb;

  v_forecast_position text := 'no_goal_configured';
  v_recommendation jsonb;
  v_recommended_realistic numeric;
  v_adjustment numeric;
  v_adjustment_pct numeric;
  v_rec_type text;
  v_rec_reason text;

  v_positive_signals jsonb := '[]'::jsonb;
  v_risk_signals jsonb := '[]'::jsonb;
  v_priority_actions jsonb := '[]'::jsonb;
  v_manager_decisions jsonb := '[]'::jsonb;
  v_seller_alerts jsonb := '[]'::jsonb;
  v_top_risky jsonb := '[]'::jsonb;
  v_top_recovery jsonb := '[]'::jsonb;
  v_contamination_reasons jsonb := '[]'::jsonb;

  v_executive_summary text := '';
  v_pct_contaminated numeric := 0;
  v_pct_with_next numeric := 0;
  v_pct_with_activity numeric := 0;

  v_top_risk_seller record;
  v_no_goal boolean := false;
BEGIN
  -- Tenant guard
  SELECT public.get_user_organization_id() INTO v_caller_org;
  v_is_platform := public.is_platform_admin();

  IF v_caller IS NOT NULL
     AND v_caller_org IS DISTINCT FROM p_organization_id
     AND NOT v_is_platform THEN
    RAISE EXCEPTION 'forbidden: organization mismatch';
  END IF;

  -- Permission scope
  v_can_view_all := v_is_platform
    OR public.has_role(v_caller, 'admin'::app_role)
    OR public.has_role(v_caller, 'owner'::app_role)
    OR public.has_role(v_caller, 'manager'::app_role);

  IF v_can_view_all THEN
    v_seller_filter := p_seller_id;
  ELSE
    v_seller_filter := v_caller;
  END IF;

  -- Default period: current month
  IF p_period_start IS NULL THEN
    p_period_start := date_trunc('month', now())::date;
  END IF;
  IF p_period_end IS NULL THEN
    p_period_end := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
  END IF;

  -- Resolve monthly goal
  BEGIN
    v_monthly_goal := public.get_seller_monthly_goal_v2(
      p_organization_id, v_seller_filter, p_period_start, p_period_end
    );
  EXCEPTION WHEN OTHERS THEN
    v_monthly_goal := NULL;
  END;
  v_no_goal := v_monthly_goal IS NULL OR v_monthly_goal <= 0;

  -- Latest run for the period
  SELECT * INTO v_run
  FROM public.forecast_calculation_runs r
  WHERE r.organization_id = p_organization_id
    AND r.period_start = p_period_start
    AND r.period_end = p_period_end
    AND (p_pipeline_id IS NULL OR r.pipeline_id = p_pipeline_id)
    AND (v_seller_filter IS NULL OR r.seller_id = v_seller_filter)
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_run.id IS NOT NULL THEN
    v_calc_version := COALESCE(v_run.calculation_version, v_calc_version);
    v_closed       := COALESCE(v_run.total_closed, 0);
    v_realistic    := COALESCE(v_run.scenario_realistic, 0);
    v_optimistic   := COALESCE(v_run.scenario_optimistic, 0);
    v_best_case    := COALESCE(v_run.scenario_best_case, 0);
    v_pessimistic  := COALESCE(v_run.scenario_pessimistic, 0);
    v_pipeline_total := COALESCE(v_run.pipeline_total, 0);
    v_deals_count  := COALESCE(v_run.deals_count, 0);
    v_included     := COALESCE(v_run.included_deals_count, 0);

    -- Items hygiene + contamination
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(i.next_step_exists,false)),
      COUNT(*) FILTER (WHERE i.last_activity_at IS NOT NULL AND i.last_activity_at >= now() - interval '7 days'),
      COALESCE(SUM(i.adjusted_value) FILTER (
        WHERE i.forecast_bucket IN ('commit','realistic')
          AND (
            'stale_activity'        = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'missing_next_step'     = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'expired_close_date'    = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'high_risk'             = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'critical_risk'         = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'end_of_month_restriction' = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            i.risk_level IN ('high','critical') OR
            COALESCE(i.nrhs_score,0) < 60
          )
      ),0),
      COUNT(*) FILTER (
        WHERE i.forecast_bucket IN ('commit','realistic')
          AND (
            'stale_activity'        = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'missing_next_step'     = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'expired_close_date'    = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'high_risk'             = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'critical_risk'         = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            'end_of_month_restriction' = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[])) OR
            i.risk_level IN ('high','critical') OR
            COALESCE(i.nrhs_score,0) < 60
          )
      ),
      COALESCE(SUM(i.adjusted_value) FILTER (WHERE i.forecast_bucket IN ('commit','realistic') AND 'stale_activity' = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[]))),0),
      COALESCE(SUM(i.adjusted_value) FILTER (WHERE i.forecast_bucket IN ('commit','realistic') AND 'missing_next_step' = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[]))),0),
      COALESCE(SUM(i.adjusted_value) FILTER (WHERE i.forecast_bucket IN ('commit','realistic') AND 'expired_close_date' = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[]))),0)
    INTO v_with_next, v_with_activity, v_contaminated_amount, v_contaminated_count,
         v_stale_amount, v_no_next_amount, v_expired_amount
    FROM public.forecast_calculation_items i
    WHERE i.run_id = v_run.id;

    -- Top risky deals
    SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb) INTO v_top_risky
    FROM (
      SELECT i.opportunity_id, i.deal_name, i.company_name, i.seller_id,
             i.deal_value, i.adjusted_value, i.forecast_bucket, i.risk_level,
             i.close_date, i.penalty_reasons
      FROM public.forecast_calculation_items i
      WHERE i.run_id = v_run.id
      ORDER BY
        (i.forecast_bucket = 'slipping') DESC,
        CASE i.risk_level WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
        i.deal_value DESC NULLS LAST,
        i.adjusted_value DESC NULLS LAST
      LIMIT 10
    ) d;

    -- Top recovery deals
    SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb) INTO v_top_recovery
    FROM (
      SELECT i.opportunity_id, i.deal_name, i.company_name, i.seller_id,
             i.deal_value, i.adjusted_value, i.forecast_bucket, i.risk_level,
             i.close_date, i.nrhs_score, i.activity_factor
      FROM public.forecast_calculation_items i
      WHERE i.run_id = v_run.id
        AND i.forecast_bucket IN ('optimistic','best_case','slipping')
        AND COALESCE(i.nrhs_score, 0) >= 60
        AND COALESCE(i.risk_level, 'low') <> 'critical'
      ORDER BY i.deal_value DESC NULLS LAST, i.nrhs_score DESC NULLS LAST, i.activity_factor DESC NULLS LAST
      LIMIT 10
    ) d;
  END IF;

  -- Snapshots / accuracy
  SELECT
    COUNT(*),
    AVG(s.accuracy_score) FILTER (WHERE s.accuracy_calculated_at IS NOT NULL),
    AVG(ABS(s.realistic_error_percentage)) FILTER (WHERE s.accuracy_calculated_at IS NOT NULL)
  INTO v_snapshots_count, v_accuracy_score, v_avg_realistic_error
  FROM public.forecast_daily_snapshots s
  WHERE s.organization_id = p_organization_id
    AND s.period_start = p_period_start
    AND s.period_end = p_period_end
    AND (p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id)
    AND (v_seller_filter IS NULL OR s.seller_id = v_seller_filter);

  -- Bias / trend (last calculated snapshot)
  SELECT s.bias_direction
  INTO v_bias_direction
  FROM public.forecast_daily_snapshots s
  WHERE s.organization_id = p_organization_id
    AND s.period_start = p_period_start
    AND s.period_end = p_period_end
    AND (p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id)
    AND (v_seller_filter IS NULL OR s.seller_id = v_seller_filter)
    AND s.accuracy_calculated_at IS NOT NULL
  ORDER BY s.snapshot_date DESC
  LIMIT 1;
  v_bias_direction := COALESCE(v_bias_direction, 'unknown');

  -- Forecast trend (compare first/second half avg error)
  IF v_snapshots_count >= 4 THEN
    WITH ordered AS (
      SELECT s.snapshot_date, ABS(s.realistic_error_percentage) AS err,
             ROW_NUMBER() OVER (ORDER BY s.snapshot_date) AS rn,
             COUNT(*) OVER () AS total
      FROM public.forecast_daily_snapshots s
      WHERE s.organization_id = p_organization_id
        AND s.period_start = p_period_start
        AND s.period_end = p_period_end
        AND (p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id)
        AND (v_seller_filter IS NULL OR s.seller_id = v_seller_filter)
        AND s.accuracy_calculated_at IS NOT NULL
    ),
    halves AS (
      SELECT
        AVG(err) FILTER (WHERE rn <= total/2) AS first_half,
        AVG(err) FILTER (WHERE rn > total/2)  AS second_half
      FROM ordered
    )
    SELECT CASE
      WHEN first_half IS NULL OR second_half IS NULL THEN 'unknown'
      WHEN second_half < first_half - 2 THEN 'improving'
      WHEN second_half > first_half + 2 THEN 'worsening'
      ELSE 'stable'
    END INTO v_forecast_trend FROM halves;
  END IF;
  v_forecast_trend := COALESCE(v_forecast_trend, 'unknown');

  -- Hygiene percentages
  IF v_included > 0 THEN
    v_pct_with_next := ROUND(v_with_next::numeric / v_included * 100, 1);
    v_pct_with_activity := ROUND(v_with_activity::numeric / v_included * 100, 1);
  END IF;
  IF v_realistic > 0 THEN
    v_pct_contaminated := ROUND(v_contaminated_amount / v_realistic * 100, 1);
  END IF;

  -- Confidence score (weighted)
  v_confidence_score := ROUND(
    (COALESCE(v_accuracy_score, 60) * 0.30) +
    (GREATEST(0, 100 - v_pct_contaminated) * 0.30) +
    (v_pct_with_next * 0.20) +
    (v_pct_with_activity * 0.20)
  , 1);
  v_confidence_score := GREATEST(0, LEAST(100, v_confidence_score));

  v_confidence_level := CASE
    WHEN v_confidence_score >= 80 THEN 'high'
    WHEN v_confidence_score >= 60 THEN 'moderate'
    WHEN v_confidence_score >= 40 THEN 'low'
    ELSE 'critical'
  END;

  -- Confidence reasons
  v_confidence_reasons := jsonb_build_array(
    jsonb_build_object('label', 'Acurácia histórica', 'value', COALESCE(v_accuracy_score, 0), 'available', v_accuracy_score IS NOT NULL),
    jsonb_build_object('label', 'Forecast contaminado', 'value', v_pct_contaminated),
    jsonb_build_object('label', 'Deals com próximo passo', 'value', v_pct_with_next),
    jsonb_build_object('label', 'Deals com atividade recente', 'value', v_pct_with_activity)
  );

  -- Forecast position
  IF v_no_goal THEN
    v_forecast_position := 'no_goal_configured';
  ELSIF v_realistic >= v_monthly_goal AND v_confidence_score >= 70
        AND (v_accuracy_score IS NULL OR v_accuracy_score >= 70) THEN
    v_forecast_position := 'above_goal_secure';
  ELSIF v_realistic >= v_monthly_goal THEN
    v_forecast_position := 'above_goal_risky';
  ELSIF v_realistic >= v_monthly_goal * 0.9 THEN
    v_forecast_position := 'near_goal';
  ELSIF v_optimistic >= v_monthly_goal THEN
    v_forecast_position := 'below_goal_recoverable';
  ELSE
    v_forecast_position := 'below_goal_critical';
  END IF;

  -- Adjustment recommendation
  IF v_no_goal THEN
    v_rec_type := 'no_goal';
    v_recommended_realistic := v_realistic;
    v_rec_reason := 'Meta mensal não configurada para este escopo.';
  ELSIF v_snapshots_count < 5 OR v_accuracy_score IS NULL THEN
    v_rec_type := 'manual_review';
    v_recommended_realistic := v_realistic;
    v_rec_reason := 'Amostra histórica insuficiente para validar o forecast (' || v_snapshots_count || ' snapshots).';
  ELSIF v_bias_direction = 'overestimating'
        OR v_confidence_score < 60
        OR v_pct_contaminated > 20 THEN
    v_rec_type := 'reduce';
    v_recommended_realistic := GREATEST(v_pessimistic, v_realistic - v_contaminated_amount * 0.5);
    v_rec_reason := 'Forecast com sinais de inflação: bias=' || v_bias_direction
                  || ', confiança=' || v_confidence_score || ', contaminação=' || v_pct_contaminated || '%.';
  ELSIF v_bias_direction = 'underestimating'
        AND COALESCE(v_accuracy_score, 0) >= 70
        AND v_confidence_score >= 70 THEN
    v_rec_type := 'increase_with_caution';
    v_recommended_realistic := v_realistic * 1.05;
    v_rec_reason := 'Histórico mostra subestimação consistente com boa acurácia.';
  ELSIF v_confidence_score >= 70 AND v_pct_contaminated < 20 THEN
    v_rec_type := 'maintain';
    v_recommended_realistic := v_realistic;
    v_rec_reason := 'Forecast saudável: confiança ' || v_confidence_score || ', contaminação baixa.';
  ELSE
    v_rec_type := 'manual_review';
    v_recommended_realistic := v_realistic;
    v_rec_reason := 'Sinais conflitantes — recomenda revisão manual.';
  END IF;

  v_adjustment := v_recommended_realistic - v_realistic;
  v_adjustment_pct := CASE WHEN v_realistic > 0 THEN ROUND(v_adjustment / v_realistic * 100, 1) ELSE 0 END;

  v_recommendation := jsonb_build_object(
    'type', v_rec_type,
    'label', CASE v_rec_type
      WHEN 'maintain' THEN 'Manter'
      WHEN 'reduce' THEN 'Reduzir'
      WHEN 'increase_with_caution' THEN 'Aumentar com cautela'
      WHEN 'manual_review' THEN 'Revisão manual'
      WHEN 'no_goal' THEN 'Meta ausente'
      ELSE v_rec_type END,
    'current_realistic', v_realistic,
    'recommended_realistic', ROUND(v_recommended_realistic, 2),
    'adjustment_amount', ROUND(v_adjustment, 2),
    'adjustment_percentage', v_adjustment_pct,
    'reason', v_rec_reason
  );

  -- Contamination reasons (text)
  v_contamination_reasons := '[]'::jsonb;
  IF v_stale_amount > 0 THEN
    v_contamination_reasons := v_contamination_reasons || to_jsonb(
      'Deals sem atividade recente contaminam R$ ' || to_char(v_stale_amount, 'FM999G999G990D00') || ' do Forecast Realista'
    );
  END IF;
  IF v_expired_amount > 0 THEN
    v_contamination_reasons := v_contamination_reasons || to_jsonb(
      'Deals com close date vencida contaminam R$ ' || to_char(v_expired_amount, 'FM999G999G990D00')
    );
  END IF;
  IF v_no_next_amount > 0 THEN
    v_contamination_reasons := v_contamination_reasons || to_jsonb(
      'Deals sem próximo passo contaminam R$ ' || to_char(v_no_next_amount, 'FM999G999G990D00')
    );
  END IF;

  -- Positive signals
  v_positive_signals := '[]'::jsonb;
  IF NOT v_no_goal AND v_closed >= v_monthly_goal * 0.5 THEN
    v_positive_signals := v_positive_signals || jsonb_build_object(
      'type','goal_progress','label','Fechado já cobre boa parte da meta',
      'value', ROUND(v_closed/v_monthly_goal*100,0)::text || '%','impact','high'
    );
  END IF;
  IF NOT v_no_goal AND v_pipeline_total >= v_monthly_goal * 3 THEN
    v_positive_signals := v_positive_signals || jsonb_build_object(
      'type','pipeline_coverage','label','Pipeline coverage saudável',
      'value', ROUND(v_pipeline_total/v_monthly_goal,1)::text || 'x','impact','high'
    );
  END IF;
  IF COALESCE(v_run.nrhs_avg, 0) >= 70 THEN
    v_positive_signals := v_positive_signals || jsonb_build_object(
      'type','nrhs_average','label','NRHS médio acima de 70',
      'value', ROUND(v_run.nrhs_avg,0)::text,'impact','medium'
    );
  END IF;
  IF v_accuracy_score IS NOT NULL AND v_accuracy_score >= 80 THEN
    v_positive_signals := v_positive_signals || jsonb_build_object(
      'type','historical_accuracy','label','Acurácia histórica acima de 80%',
      'value', ROUND(v_accuracy_score,0)::text || '%','impact','high'
    );
  END IF;
  IF v_bias_direction = 'balanced' THEN
    v_positive_signals := v_positive_signals || jsonb_build_object(
      'type','balanced_bias','label','Bias equilibrado','value','—','impact','medium'
    );
  END IF;
  IF v_pct_with_next >= 80 THEN
    v_positive_signals := v_positive_signals || jsonb_build_object(
      'type','next_step_coverage','label','Maioria dos deals com próximo passo',
      'value', v_pct_with_next::text || '%','impact','medium'
    );
  END IF;

  -- Risk signals
  v_risk_signals := '[]'::jsonb;
  IF v_bias_direction = 'overestimating' THEN
    v_risk_signals := v_risk_signals || jsonb_build_object(
      'type','overestimating_bias','label','Forecast inflando historicamente',
      'value','bias overestimating','severity','high'
    );
  END IF;
  IF v_confidence_score < 60 THEN
    v_risk_signals := v_risk_signals || jsonb_build_object(
      'type','low_confidence','label','Confiança abaixo de 60%',
      'value', v_confidence_score::text,'severity','high'
    );
  END IF;
  IF v_stale_amount > 0 THEN
    v_risk_signals := v_risk_signals || jsonb_build_object(
      'type','stale_activity','label','Deals sem atividade recente no Realista',
      'value', 'R$ ' || to_char(v_stale_amount, 'FM999G999G990D00'),'severity','high'
    );
  END IF;
  IF v_no_next_amount > 0 THEN
    v_risk_signals := v_risk_signals || jsonb_build_object(
      'type','missing_next_step','label','Deals sem próximo passo no Realista',
      'value','R$ ' || to_char(v_no_next_amount, 'FM999G999G990D00'),'severity','medium'
    );
  END IF;
  IF v_expired_amount > 0 THEN
    v_risk_signals := v_risk_signals || jsonb_build_object(
      'type','expired_close_date','label','Deals com close date vencida',
      'value','R$ ' || to_char(v_expired_amount, 'FM999G999G990D00'),'severity','high'
    );
  END IF;
  IF v_run.id IS NOT NULL AND COALESCE(v_run.slipping_deals_count,0) > 0 THEN
    v_risk_signals := v_risk_signals || jsonb_build_object(
      'type','slipping_deals','label','Deals slipping para fora do mês',
      'value', v_run.slipping_deals_count::text || ' deals','severity','medium'
    );
  END IF;
  IF v_pct_contaminated >= 20 THEN
    v_risk_signals := v_risk_signals || jsonb_build_object(
      'type','contaminated_realistic','label','Realista contaminado',
      'value', v_pct_contaminated::text || '% do Realista','severity','critical'
    );
  END IF;

  -- Priority actions
  v_priority_actions := '[]'::jsonb;
  IF v_stale_amount > 0 THEN
    v_priority_actions := v_priority_actions || jsonb_build_object(
      'title','Reativar deals parados','description','Reabrir conversas com deals sem atividade nos últimos 7 dias.',
      'action_type','reactivate_stale_deals','priority','high',
      'estimated_recovered_amount', v_stale_amount,
      'related_deals_count', (SELECT COUNT(*) FROM public.forecast_calculation_items i WHERE i.run_id = v_run.id AND 'stale_activity' = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[]))),
      'seller_id', NULL
    );
  END IF;
  IF v_expired_amount > 0 THEN
    v_priority_actions := v_priority_actions || jsonb_build_object(
      'title','Corrigir close date vencida','description','Atualizar close date de deals com data passada.',
      'action_type','fix_expired_close_dates','priority','high',
      'estimated_recovered_amount', v_expired_amount,
      'related_deals_count', (SELECT COUNT(*) FROM public.forecast_calculation_items i WHERE i.run_id = v_run.id AND 'expired_close_date' = ANY(COALESCE(i.penalty_reasons, ARRAY[]::text[]))),
      'seller_id', NULL
    );
  END IF;
  IF v_no_next_amount > 0 THEN
    v_priority_actions := v_priority_actions || jsonb_build_object(
      'title','Definir próximo passo','description','Cadastrar próximo passo nos deals sem ação planejada.',
      'action_type','define_next_steps','priority','medium',
      'estimated_recovered_amount', v_no_next_amount,
      'related_deals_count', (SELECT COUNT(*) FROM public.forecast_calculation_items i WHERE i.run_id = v_run.id AND COALESCE(i.next_step_exists,false) = false),
      'seller_id', NULL
    );
  END IF;
  IF v_contaminated_amount > 0 THEN
    v_priority_actions := v_priority_actions || jsonb_build_object(
      'title','Revisar deals contaminados','description','Validar deals do Realista com sinais ruins antes de manter no forecast.',
      'action_type','review_contaminated_forecast','priority','high',
      'estimated_recovered_amount', v_contaminated_amount,
      'related_deals_count', v_contaminated_count,
      'seller_id', NULL
    );
  END IF;
  IF v_no_goal THEN
    v_priority_actions := v_priority_actions || jsonb_build_object(
      'title','Configurar meta mensal','description','Defina a meta para que o sistema possa medir cobertura e gap.',
      'action_type','configure_goal','priority','high',
      'estimated_recovered_amount', 0, 'related_deals_count', 0, 'seller_id', NULL
    );
  END IF;

  -- Seller alerts + coach action (only when not seller-scoped)
  IF v_can_view_all THEN
    BEGIN
      WITH perf AS (
        SELECT * FROM public.get_forecast_seller_performance_v2(p_organization_id, p_pipeline_id, p_period_start, p_period_end)
      ),
      acc AS (
        SELECT * FROM public.get_forecast_seller_accuracy_v2(p_organization_id, p_pipeline_id, p_period_start, p_period_end)
      )
      SELECT COALESCE(jsonb_agg(alert), '[]'::jsonb)
      INTO v_seller_alerts
      FROM (
        -- missing goal
        SELECT jsonb_build_object('seller_id', p.seller_id, 'seller_name', p.seller_name,
          'alert_type','missing_goal','label','Sem meta configurada','severity','medium','amount',0) AS alert
        FROM perf p WHERE NOT p.has_goal
        UNION ALL
        SELECT jsonb_build_object('seller_id', p.seller_id, 'seller_name', p.seller_name,
          'alert_type','goal_gap','label','Gap relevante para a meta','severity','high','amount', p.gap_to_goal)
        FROM perf p WHERE p.has_goal AND p.gap_to_goal > 0 AND p.goal_attainment_percentage < 80
        UNION ALL
        SELECT jsonb_build_object('seller_id', p.seller_id, 'seller_name', p.seller_name,
          'alert_type','low_coverage','label','Cobertura de pipeline baixa','severity','high','amount', p.pipeline_total)
        FROM perf p WHERE p.has_goal AND p.coverage_ratio < 2
        UNION ALL
        SELECT jsonb_build_object('seller_id', p.seller_id, 'seller_name', p.seller_name,
          'alert_type','high_risk_amount','label','Alto valor em risco','severity','high','amount', p.risk_amount)
        FROM perf p WHERE p.risk_amount > 0
        UNION ALL
        SELECT jsonb_build_object('seller_id', p.seller_id, 'seller_name', p.seller_name,
          'alert_type','low_confidence','label','Confiança do forecast baixa','severity','medium','amount', p.forecast_confidence)
        FROM perf p WHERE p.forecast_confidence IS NOT NULL AND p.forecast_confidence < 60
        UNION ALL
        SELECT jsonb_build_object('seller_id', a.seller_id, 'seller_name', a.seller_name,
          'alert_type','overestimating_bias','label','Forecast inflando','severity','high','amount', a.avg_error_percentage)
        FROM acc a WHERE a.bias_direction = 'overestimating' AND a.snapshots_count >= 3
      ) s;
    EXCEPTION WHEN OTHERS THEN
      v_seller_alerts := '[]'::jsonb;
    END;

    -- Top risky seller for coach action
    BEGIN
      SELECT seller_id, seller_name, risk_amount
      INTO v_top_risk_seller
      FROM public.get_forecast_seller_performance_v2(p_organization_id, p_pipeline_id, p_period_start, p_period_end)
      WHERE risk_amount > 0
      ORDER BY risk_amount DESC
      LIMIT 1;

      IF v_top_risk_seller.seller_id IS NOT NULL THEN
        v_priority_actions := v_priority_actions || jsonb_build_object(
          'title','Cobrar plano de recuperação',
          'description', 'Vendedor ' || COALESCE(v_top_risk_seller.seller_name, '—') || ' concentra o maior valor em risco.',
          'action_type','coach_risky_seller','priority','high',
          'estimated_recovered_amount', v_top_risk_seller.risk_amount,
          'related_deals_count', 0,
          'seller_id', v_top_risk_seller.seller_id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Manager decisions
  v_manager_decisions := '[]'::jsonb;
  IF v_rec_type = 'reduce' THEN
    v_manager_decisions := v_manager_decisions || jsonb_build_object(
      'question','Manter ou reduzir o Forecast Realista?',
      'context','Sinais de inflação detectados. Recomendação é reduzir o realista.',
      'suggested_decision','Reduzir para R$ ' || to_char(v_recommended_realistic, 'FM999G999G990D00'),
      'financial_impact', ROUND(v_realistic - v_recommended_realistic, 2),
      'urgency','high'
    );
  END IF;
  IF v_run.id IS NOT NULL AND COALESCE(v_run.slipping_deals_count,0) > 0 THEN
    v_manager_decisions := v_manager_decisions || jsonb_build_object(
      'question','Tratar deals slipping como carry-over?',
      'context', v_run.slipping_deals_count || ' deals indicam estouro de close date.',
      'suggested_decision','Mover para o próximo período após validação',
      'financial_impact', 0, 'urgency','medium'
    );
  END IF;
  IF v_top_risk_seller.seller_id IS NOT NULL THEN
    v_manager_decisions := v_manager_decisions || jsonb_build_object(
      'question','Cobrar plano de recuperação do vendedor ' || COALESCE(v_top_risk_seller.seller_name,'—') || '?',
      'context','Maior concentração de risco no período.',
      'suggested_decision','1:1 imediato com plano de ação',
      'financial_impact', v_top_risk_seller.risk_amount, 'urgency','high'
    );
  END IF;
  IF v_no_goal THEN
    v_manager_decisions := v_manager_decisions || jsonb_build_object(
      'question','Configurar meta mensal ausente?','context','Sem meta o sistema não consegue medir gap e cobertura.',
      'suggested_decision','Definir meta no módulo de Metas','financial_impact', 0,'urgency','high'
    );
  END IF;

  -- Executive summary
  v_executive_summary :=
    CASE v_forecast_position
      WHEN 'above_goal_secure' THEN 'Forecast acima da meta com sinais sustentáveis.'
      WHEN 'above_goal_risky' THEN 'Forecast acima da meta, mas com sinais de risco. '
      WHEN 'near_goal' THEN 'Forecast próximo da meta. Execução das próximas 24h define o resultado. '
      WHEN 'below_goal_recoverable' THEN 'Forecast abaixo da meta, mas recuperável via cenário otimista. '
      WHEN 'below_goal_critical' THEN 'Forecast abaixo da meta inclusive no cenário otimista. '
      WHEN 'no_goal_configured' THEN 'Sem meta configurada — diagnóstico operacional disponível. '
      ELSE ''
    END
    || ' Recomendação: ' ||
    CASE v_rec_type
      WHEN 'maintain' THEN 'manter o realista.'
      WHEN 'reduce' THEN 'reduzir o realista para R$ ' || to_char(v_recommended_realistic, 'FM999G999G990D00') || '.'
      WHEN 'increase_with_caution' THEN 'aumentar com cautela.'
      WHEN 'manual_review' THEN 'revisar manualmente.'
      WHEN 'no_goal' THEN 'configurar meta mensal.'
      ELSE v_rec_type
    END;

  RETURN jsonb_build_object(
    'executive_summary', v_executive_summary,
    'confidence_score', v_confidence_score,
    'confidence_level', v_confidence_level,
    'confidence_reasons', v_confidence_reasons,
    'forecast_position', v_forecast_position,
    'forecast_adjustment_recommendation', v_recommendation,
    'positive_signals', v_positive_signals,
    'risk_signals', v_risk_signals,
    'priority_actions', v_priority_actions,
    'manager_decisions', v_manager_decisions,
    'seller_alerts', v_seller_alerts,
    'contaminated_forecast', jsonb_build_object(
      'amount', v_contaminated_amount,
      'deals_count', v_contaminated_count,
      'reasons', v_contamination_reasons
    ),
    'top_risky_deals', v_top_risky,
    'top_recovery_deals', v_top_recovery,
    'metadata', jsonb_build_object(
      'calculation_version', v_calc_version,
      'snapshots_count', v_snapshots_count,
      'accuracy_score', v_accuracy_score,
      'bias_direction', v_bias_direction,
      'forecast_trend', v_forecast_trend,
      'monthly_goal', v_monthly_goal,
      'closed_amount', v_closed,
      'scenario_realistic', v_realistic,
      'scenario_optimistic', v_optimistic,
      'scenario_best_case', v_best_case,
      'scenario_pessimistic', v_pessimistic,
      'pipeline_total', v_pipeline_total,
      'deals_count', v_deals_count,
      'included_deals_count', v_included,
      'has_run', v_run.id IS NOT NULL,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'pipeline_id', p_pipeline_id,
      'seller_id', v_seller_filter,
      'generated_at', now()
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_forecast_intelligence_v2(uuid, uuid, date, date, uuid) TO authenticated;