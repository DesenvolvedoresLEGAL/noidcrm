-- Sprint F2.7: Forecast Risk Center V2

CREATE OR REPLACE FUNCTION public.get_forecast_risk_center_v2(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_pipeline_id uuid DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_privileged boolean := false;
  v_effective_seller uuid := p_seller_id;
  v_run_id uuid;
  v_calculation_version text;
  v_run_created_at timestamptz;
  v_empty jsonb;
  v_summary jsonb;
  v_groups jsonb;
  v_seller_ranking jsonb;
  v_top_risky jsonb;
  v_top_recovery jsonb;
  v_quick_actions jsonb;
  v_total_deals int := 0;
  v_total_risk_amount numeric := 0;
  v_total_risk_deals int := 0;
  v_critical_amount numeric := 0;
  v_critical_deals int := 0;
  v_slipping_amount numeric := 0;
  v_slipping_deals int := 0;
  v_hygiene_amount numeric := 0;
  v_hygiene_deals int := 0;
  v_contaminated_amount numeric := 0;
  v_contaminated_deals int := 0;
  v_recoverable_amount numeric := 0;
  v_no_activity_deals int := 0;
  v_no_next_step_deals int := 0;
  v_avg_nrhs_risk numeric := 60;
  v_has_expired boolean := false;
  v_confidence_score numeric := 70;
  v_risk_score int := 0;
BEGIN
  v_empty := jsonb_build_object(
    'summary', jsonb_build_object(
      'total_risk_amount', 0,'total_risk_deals', 0,
      'critical_risk_amount', 0,'critical_risk_deals', 0,
      'slipping_amount', 0,'slipping_deals', 0,
      'hygiene_issue_amount', 0,'hygiene_issue_deals', 0,
      'contaminated_realistic_amount', 0,'contaminated_realistic_deals', 0,
      'recoverable_amount', 0,'risk_score', 0
    ),
    'groups', '[]'::jsonb,
    'seller_risk_ranking', '[]'::jsonb,
    'top_risky_deals', '[]'::jsonb,
    'top_recovery_deals', '[]'::jsonb,
    'quick_actions', '[]'::jsonb,
    'metadata', jsonb_build_object(
      'run_id', NULL,
      'calculation_version', NULL,
      'generated_at', now(),
      'period_start', p_period_start,
      'period_end', p_period_end
    )
  );

  IF v_user_id IS NULL OR p_organization_id IS NULL THEN
    RETURN v_empty;
  END IF;

  -- Authorization: must belong to org
  IF p_organization_id <> public.get_user_organization_id() THEN
    RETURN v_empty;
  END IF;

  v_is_privileged := public.is_org_admin(p_organization_id, v_user_id)
    OR public.has_role(v_user_id, 'manager'::app_role)
    OR public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'owner'::app_role)
    OR public.has_role(v_user_id, 'platform_admin'::app_role);

  IF NOT v_is_privileged THEN
    v_effective_seller := v_user_id;
  END IF;

  -- Find most recent run for org/pipeline/period
  SELECT id, COALESCE(calculation_version, 'forecast_v2_engine_1'), created_at
    INTO v_run_id, v_calculation_version, v_run_created_at
  FROM public.forecast_calculation_runs
  WHERE organization_id = p_organization_id
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    AND period_start = p_period_start
    AND period_end = p_period_end
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_run_id IS NULL THEN
    RETURN v_empty;
  END IF;

  -- Build classified items in a temp set
  CREATE TEMP TABLE IF NOT EXISTS _fci_class ON COMMIT DROP AS
  SELECT
    fci.opportunity_id,
    fci.deal_name,
    fci.company_name,
    fci.seller_id,
    fci.stage_id,
    fci.deal_value,
    fci.adjusted_value,
    fci.forecast_bucket,
    fci.eligibility_status,
    fci.risk_level,
    fci.close_date,
    fci.last_activity_at,
    COALESCE(fci.next_step_exists, false) AS next_step_exists,
    fci.nrhs_score,
    COALESCE(fci.activity_factor, 0) AS activity_factor,
    COALESCE(fci.penalty_reasons, '{}'::text[]) AS penalty_reasons,
    COALESCE(fci.exclusion_reasons, '{}'::text[]) AS exclusion_reasons,
    -- Classification booleans
    (fci.risk_level = 'critical' OR 'critical_risk' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))) AS is_critical,
    (fci.risk_level = 'high' OR 'high_risk' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))) AS is_attention,
    (
      fci.eligibility_status = 'slipping'
      OR fci.forecast_bucket = 'slipping'
      OR 'end_of_month_restriction' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))
      OR (fci.close_date IS NOT NULL AND (fci.close_date < p_period_start OR fci.close_date > p_period_end))
    ) AS is_slipping,
    (fci.last_activity_at IS NULL OR fci.last_activity_at < (now() - interval '7 days')) AS is_no_activity,
    (COALESCE(fci.next_step_exists,false) = false) AS is_no_next_step,
    (fci.nrhs_score IS NOT NULL AND fci.nrhs_score < 60) AS is_low_nrhs,
    (fci.close_date IS NOT NULL AND fci.close_date < current_date AND fci.eligibility_status NOT IN ('closed') AND fci.forecast_bucket NOT IN ('closed','excluded')) AS is_expired,
    (
      fci.forecast_bucket IN ('commit','realistic')
      AND (
        'stale_activity' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))
        OR 'missing_next_step' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))
        OR 'expired_close_date' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))
        OR 'high_risk' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))
        OR 'critical_risk' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))
        OR 'end_of_month_restriction' = ANY(COALESCE(fci.penalty_reasons,'{}'::text[]))
        OR (fci.nrhs_score IS NOT NULL AND fci.nrhs_score < 60)
        OR fci.risk_level IN ('high','critical')
      )
    ) AS is_contaminated_realistic,
    (
      COALESCE(fci.next_step_exists,false) = false
      OR fci.last_activity_at IS NULL OR fci.last_activity_at < (now() - interval '7 days')
      OR (fci.close_date IS NOT NULL AND fci.close_date < current_date)
      OR (fci.nrhs_score IS NOT NULL AND fci.nrhs_score < 60)
      OR COALESCE(fci.deal_value,0) <= 0
    ) AS is_hygiene
  FROM public.forecast_calculation_items fci
  WHERE fci.run_id = v_run_id
    AND fci.organization_id = p_organization_id
    AND (v_effective_seller IS NULL OR fci.seller_id = v_effective_seller)
    AND fci.forecast_bucket <> 'excluded';

  -- Aggregations
  SELECT count(*),
         COALESCE(sum(deal_value) FILTER (WHERE is_critical OR is_attention OR is_slipping OR is_hygiene OR is_contaminated_realistic),0),
         count(*) FILTER (WHERE is_critical OR is_attention OR is_slipping OR is_hygiene OR is_contaminated_realistic),
         COALESCE(sum(deal_value) FILTER (WHERE is_critical),0), count(*) FILTER (WHERE is_critical),
         COALESCE(sum(deal_value) FILTER (WHERE is_slipping),0), count(*) FILTER (WHERE is_slipping),
         COALESCE(sum(deal_value) FILTER (WHERE is_hygiene),0), count(*) FILTER (WHERE is_hygiene),
         COALESCE(sum(adjusted_value) FILTER (WHERE is_contaminated_realistic),0), count(*) FILTER (WHERE is_contaminated_realistic),
         COALESCE(sum(deal_value) FILTER (WHERE (is_slipping OR is_attention OR is_no_activity OR is_no_next_step OR is_expired) AND COALESCE(nrhs_score,0) >= 60 AND COALESCE(risk_level,'') <> 'critical'),0),
         count(*) FILTER (WHERE is_no_activity),
         count(*) FILTER (WHERE is_no_next_step),
         COALESCE(avg(nrhs_score) FILTER (WHERE is_critical OR is_attention OR is_contaminated_realistic),60),
         bool_or(is_expired)
    INTO v_total_deals, v_total_risk_amount, v_total_risk_deals,
         v_critical_amount, v_critical_deals,
         v_slipping_amount, v_slipping_deals,
         v_hygiene_amount, v_hygiene_deals,
         v_contaminated_amount, v_contaminated_deals,
         v_recoverable_amount,
         v_no_activity_deals, v_no_next_step_deals,
         v_avg_nrhs_risk, v_has_expired
  FROM _fci_class;

  -- Confidence score from latest snapshot (best effort)
  BEGIN
    SELECT COALESCE(s.accuracy_score, 70)
      INTO v_confidence_score
    FROM public.forecast_daily_snapshots s
    WHERE s.organization_id = p_organization_id
      AND (p_pipeline_id IS NULL OR s.pipeline_id = p_pipeline_id)
    ORDER BY s.snapshot_date DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_confidence_score := 70;
  END;

  -- Risk score
  v_risk_score := 0;
  IF v_total_deals > 0 THEN
    IF (v_contaminated_amount / NULLIF(v_total_risk_amount + v_contaminated_amount, 0)) > 0.20 THEN v_risk_score := v_risk_score + 20; END IF;
    IF v_critical_deals > 0 THEN v_risk_score := v_risk_score + 15; END IF;
    IF (v_slipping_deals::numeric / GREATEST(v_total_deals,1)) > 0.10 THEN v_risk_score := v_risk_score + 15; END IF;
    IF (v_no_activity_deals::numeric / GREATEST(v_total_deals,1)) > 0.30 THEN v_risk_score := v_risk_score + 15; END IF;
    IF (v_no_next_step_deals::numeric / GREATEST(v_total_deals,1)) > 0.20 THEN v_risk_score := v_risk_score + 10; END IF;
    IF v_has_expired THEN v_risk_score := v_risk_score + 10; END IF;
    IF v_avg_nrhs_risk < 60 THEN v_risk_score := v_risk_score + 10; END IF;
    IF v_confidence_score < 60 THEN v_risk_score := v_risk_score + 5; END IF;
  END IF;
  v_risk_score := LEAST(100, GREATEST(0, v_risk_score));

  v_summary := jsonb_build_object(
    'total_risk_amount', v_total_risk_amount,
    'total_risk_deals', v_total_risk_deals,
    'critical_risk_amount', v_critical_amount,
    'critical_risk_deals', v_critical_deals,
    'slipping_amount', v_slipping_amount,
    'slipping_deals', v_slipping_deals,
    'hygiene_issue_amount', v_hygiene_amount,
    'hygiene_issue_deals', v_hygiene_deals,
    'contaminated_realistic_amount', v_contaminated_amount,
    'contaminated_realistic_deals', v_contaminated_deals,
    'recoverable_amount', v_recoverable_amount,
    'risk_score', v_risk_score
  );

  -- Helper to build deal json
  CREATE TEMP TABLE IF NOT EXISTS _fci_deal_json ON COMMIT DROP AS
  SELECT c.*,
    COALESCE(p.full_name, p.email) AS seller_name,
    jsonb_build_object(
      'opportunity_id', c.opportunity_id,
      'deal_name', c.deal_name,
      'company_name', c.company_name,
      'seller_id', c.seller_id,
      'seller_name', COALESCE(p.full_name, p.email),
      'stage_id', c.stage_id,
      'stage_name', NULL,
      'deal_value', c.deal_value,
      'adjusted_value', c.adjusted_value,
      'forecast_bucket', c.forecast_bucket,
      'eligibility_status', c.eligibility_status,
      'risk_level', c.risk_level,
      'close_date', c.close_date,
      'last_activity_at', c.last_activity_at,
      'next_step_exists', c.next_step_exists,
      'nrhs_score', c.nrhs_score,
      'forecast_impact', c.adjusted_value,
      'penalty_reasons', to_jsonb(c.penalty_reasons),
      'exclusion_reasons', to_jsonb(c.exclusion_reasons),
      'recommended_action', CASE
        WHEN c.is_critical THEN 'manager_decision_required'
        WHEN c.is_slipping THEN 'fix_slipping'
        WHEN c.is_expired THEN 'fix_expired_close_date'
        WHEN c.is_no_next_step THEN 'define_next_steps'
        WHEN c.is_no_activity THEN 'reactivate_stale_deals'
        WHEN c.is_contaminated_realistic THEN 'review_contaminated_realistic'
        WHEN c.is_low_nrhs THEN 'improve_nrhs'
        ELSE 'fix_hygiene'
      END
    ) AS deal_json
  FROM _fci_class c
  LEFT JOIN public.profiles p ON p.id = c.seller_id;

  -- Build groups
  WITH g AS (
    SELECT 'critical_risk' AS k, 'Risco Crítico' AS title, 'critical' AS sev,
           'Decidir se o deal permanece no forecast ou sai do mês.' AS action,
           'manager_decision_required' AS atype,
           'Deals com risco crítico que ameaçam o forecast.' AS descr
    UNION ALL SELECT 'attention_risk','Atenção','high','Executar follow up prioritário e validar chance real de fechamento.','priority_follow_up','Deals com risco alto que precisam de atenção imediata.'
    UNION ALL SELECT 'slipping','Slipping','high','Atualizar close date ou mover para próximo mês.','fix_slipping','Deals escorregando para fora do período.'
    UNION ALL SELECT 'hygiene_issue','Higiene Operacional','medium','Corrigir higiene operacional antes de confiar no forecast.','fix_hygiene','Deals com problemas operacionais.'
    UNION ALL SELECT 'no_activity','Sem Atividade','medium','Reativar oportunidades paradas hoje.','reactivate_stale_deals','Deals sem atividade nos últimos 7 dias.'
    UNION ALL SELECT 'no_next_step','Sem Próximo Passo','medium','Definir próximo passo para todas as oportunidades abertas.','define_next_steps','Deals sem próximo passo definido.'
    UNION ALL SELECT 'low_nrhs','NRHS Baixo','medium','Corrigir dados e sinais comerciais para aumentar confiabilidade.','improve_nrhs','Deals com NRHS abaixo de 60.'
    UNION ALL SELECT 'expired_close_date','Close Date Vencida','high','Atualizar close date vencida ou remover do forecast do mês.','fix_expired_close_date','Deals com close date vencida e ainda abertos.'
    UNION ALL SELECT 'contaminated_realistic','Forecast Realista Contaminado','critical','Revisar deals que estão inflando o Forecast Realista.','review_contaminated_realistic','Deals em commit/realistic com sinais ruins.'
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'group_key', g.k,
      'title', g.title,
      'description', g.descr,
      'severity', g.sev,
      'deals_count', stats.cnt,
      'gross_amount', stats.gross,
      'adjusted_amount', stats.adj,
      'forecast_impact', stats.adj,
      'recoverable_amount', stats.recov,
      'recommended_action', g.action,
      'action_type', g.atype,
      'deals', stats.deals
    ) ORDER BY 
      CASE g.sev WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      stats.cnt DESC
  ), '[]'::jsonb) INTO v_groups
  FROM g
  LEFT JOIN LATERAL (
    SELECT
      count(*) AS cnt,
      COALESCE(sum(deal_value),0) AS gross,
      COALESCE(sum(adjusted_value),0) AS adj,
      COALESCE(sum(deal_value) FILTER (WHERE COALESCE(nrhs_score,0) >= 60 AND COALESCE(risk_level,'') <> 'critical'),0) AS recov,
      COALESCE(jsonb_agg(deal_json ORDER BY deal_value DESC) FILTER (WHERE TRUE), '[]'::jsonb) AS deals
    FROM _fci_deal_json d
    WHERE
      (g.k = 'critical_risk' AND d.is_critical)
      OR (g.k = 'attention_risk' AND d.is_attention)
      OR (g.k = 'slipping' AND d.is_slipping)
      OR (g.k = 'hygiene_issue' AND d.is_hygiene)
      OR (g.k = 'no_activity' AND d.is_no_activity)
      OR (g.k = 'no_next_step' AND d.is_no_next_step)
      OR (g.k = 'low_nrhs' AND d.is_low_nrhs)
      OR (g.k = 'expired_close_date' AND d.is_expired)
      OR (g.k = 'contaminated_realistic' AND d.is_contaminated_realistic)
  ) stats ON TRUE;

  -- Seller ranking
  SELECT COALESCE(jsonb_agg(row_to_jsonb(r) ORDER BY r.risk_amount DESC, r.risk_deals_count DESC, r.risk_score DESC), '[]'::jsonb)
    INTO v_seller_ranking
  FROM (
    SELECT
      d.seller_id,
      MAX(d.seller_name) AS seller_name,
      COALESCE(sum(d.deal_value) FILTER (WHERE d.is_critical OR d.is_attention OR d.is_slipping OR d.is_contaminated_realistic),0) AS risk_amount,
      count(*) FILTER (WHERE d.is_critical OR d.is_attention OR d.is_slipping OR d.is_contaminated_realistic) AS risk_deals_count,
      COALESCE(sum(d.deal_value) FILTER (WHERE d.is_slipping),0) AS slipping_amount,
      count(*) FILTER (WHERE d.is_slipping) AS slipping_deals_count,
      count(*) FILTER (WHERE d.is_hygiene) AS hygiene_issue_deals,
      COALESCE(sum(d.adjusted_value) FILTER (WHERE d.is_contaminated_realistic),0) AS contaminated_realistic_amount,
      LEAST(100, GREATEST(0,
        (CASE WHEN count(*) FILTER (WHERE d.is_critical) > 0 THEN 30 ELSE 0 END) +
        (CASE WHEN count(*) FILTER (WHERE d.is_slipping) > 0 THEN 20 ELSE 0 END) +
        (CASE WHEN count(*) FILTER (WHERE d.is_contaminated_realistic) > 0 THEN 20 ELSE 0 END) +
        (CASE WHEN count(*) FILTER (WHERE d.is_hygiene) > 0 THEN 15 ELSE 0 END) +
        (CASE WHEN count(*) FILTER (WHERE d.is_no_activity) > 0 THEN 15 ELSE 0 END)
      ))::int AS risk_score,
      CASE
        WHEN count(*) FILTER (WHERE d.is_critical) > 0 THEN 'coach_risky_seller'
        WHEN count(*) FILTER (WHERE d.is_slipping) > 0 THEN 'fix_slipping'
        WHEN count(*) FILTER (WHERE d.is_contaminated_realistic) > 0 THEN 'review_contaminated_realistic'
        ELSE 'fix_hygiene'
      END AS recommended_action
    FROM _fci_deal_json d
    WHERE d.seller_id IS NOT NULL
    GROUP BY d.seller_id
  ) r;

  -- Top risky deals
  SELECT COALESCE(jsonb_agg(deal_json ORDER BY
    (CASE WHEN risk_level='critical' THEN 0 ELSE 1 END),
    (CASE WHEN forecast_bucket='slipping' OR is_slipping THEN 0 ELSE 1 END),
    (CASE WHEN is_contaminated_realistic THEN 0 ELSE 1 END),
    deal_value DESC,
    COALESCE(array_length(penalty_reasons,1),0) DESC
  ), '[]'::jsonb)
    INTO v_top_risky
  FROM (
    SELECT * FROM _fci_deal_json
    WHERE is_critical OR is_attention OR is_slipping OR is_contaminated_realistic OR is_expired
    LIMIT 10
  ) t;

  -- Top recovery deals
  SELECT COALESCE(jsonb_agg(deal_json ORDER BY deal_value DESC), '[]'::jsonb)
    INTO v_top_recovery
  FROM (
    SELECT * FROM _fci_deal_json
    WHERE COALESCE(nrhs_score,0) >= 60
      AND COALESCE(risk_level,'') <> 'critical'
      AND forecast_bucket IN ('optimistic','best_case','slipping','realistic')
      AND activity_factor >= 0.30
    ORDER BY deal_value DESC
    LIMIT 10
  ) t;

  -- Quick actions
  WITH a AS (
    SELECT 'fix_expired_close_date' AS atype, 'Corrigir close dates vencidas' AS title,
           'Atualize ou remova close dates vencidas para limpar o forecast.' AS descr,
           count(*) FILTER (WHERE is_expired) AS cnt,
           COALESCE(sum(deal_value) FILTER (WHERE is_expired),0) AS amt
    FROM _fci_class
    UNION ALL
    SELECT 'reactivate_stale_deals','Reativar deals parados',
           'Retome o contato com oportunidades sem atividade recente.',
           count(*) FILTER (WHERE is_no_activity),
           COALESCE(sum(deal_value) FILTER (WHERE is_no_activity),0)
    FROM _fci_class
    UNION ALL
    SELECT 'define_next_steps','Definir próximos passos',
           'Crie próximo passo para oportunidades abertas sem cadência.',
           count(*) FILTER (WHERE is_no_next_step),
           COALESCE(sum(deal_value) FILTER (WHERE is_no_next_step),0)
    FROM _fci_class
    UNION ALL
    SELECT 'review_contaminated_realistic','Revisar Forecast Realista contaminado',
           'Deals em commit/realistic com sinais ruins inflam o forecast.',
           count(*) FILTER (WHERE is_contaminated_realistic),
           COALESCE(sum(adjusted_value) FILTER (WHERE is_contaminated_realistic),0)
    FROM _fci_class
    UNION ALL
    SELECT 'move_slipping_to_next_month','Mover slipping para próximo mês',
           'Reagende deals que não fecham no período atual.',
           count(*) FILTER (WHERE is_slipping),
           COALESCE(sum(deal_value) FILTER (WHERE is_slipping),0)
    FROM _fci_class
    UNION ALL
    SELECT 'coach_risky_seller','Cobrar vendedor com maior risco',
           'Reúna-se com o vendedor que concentra o risco do mês.',
           CASE WHEN v_seller_ranking IS NULL OR jsonb_array_length(v_seller_ranking) = 0 THEN 0 ELSE 1 END,
           CASE WHEN v_seller_ranking IS NULL OR jsonb_array_length(v_seller_ranking) = 0 THEN 0
                ELSE COALESCE((v_seller_ranking->0->>'risk_amount')::numeric, 0) END
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action_type', atype,
      'title', title,
      'description', descr,
      'deals_count', cnt,
      'amount', amt,
      'priority', CASE
        WHEN cnt = 0 THEN 'low'
        WHEN amt >= 100000 OR cnt >= 10 THEN 'critical'
        WHEN amt >= 30000 OR cnt >= 5 THEN 'high'
        ELSE 'medium'
      END
    ) ORDER BY
      CASE WHEN cnt = 0 THEN 1 ELSE 0 END,
      amt DESC
  ), '[]'::jsonb) INTO v_quick_actions
  FROM a;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'groups', COALESCE(v_groups, '[]'::jsonb),
    'seller_risk_ranking', COALESCE(v_seller_ranking, '[]'::jsonb),
    'top_risky_deals', COALESCE(v_top_risky, '[]'::jsonb),
    'top_recovery_deals', COALESCE(v_top_recovery, '[]'::jsonb),
    'quick_actions', COALESCE(v_quick_actions, '[]'::jsonb),
    'metadata', jsonb_build_object(
      'run_id', v_run_id,
      'calculation_version', v_calculation_version,
      'generated_at', now(),
      'period_start', p_period_start,
      'period_end', p_period_end
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN v_empty || jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_risk_center_v2(uuid, date, date, uuid, uuid) TO authenticated;