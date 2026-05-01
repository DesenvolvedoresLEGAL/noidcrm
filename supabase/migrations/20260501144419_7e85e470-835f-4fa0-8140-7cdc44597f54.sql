-- Sprint F2.8: Forecast V2 health check & governance

ALTER TABLE public.forecast_snapshot_job_logs
  ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.forecast_calculation_runs
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE TABLE IF NOT EXISTS public.forecast_v2_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pipeline_id uuid NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL,
  warnings_count integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  duration_ms integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fhl_org_created
  ON public.forecast_v2_health_logs (organization_id, created_at DESC);

ALTER TABLE public.forecast_v2_health_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhl_select_admin" ON public.forecast_v2_health_logs;
CREATE POLICY "fhl_select_admin" ON public.forecast_v2_health_logs
FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.is_org_admin(organization_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

DROP POLICY IF EXISTS "fhl_insert_block" ON public.forecast_v2_health_logs;
CREATE POLICY "fhl_insert_block" ON public.forecast_v2_health_logs
FOR INSERT TO authenticated
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.get_forecast_v2_health_check(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_t_start timestamptz := clock_timestamp();
  v_is_privileged boolean := false;
  v_flag_enabled boolean := false;
  v_run record;
  v_snap record;
  v_snap_count int := 0;
  v_job record;
  v_warnings jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_recommendations jsonb := '[]'::jsonb;
  v_consistency jsonb;
  v_status text := 'healthy';
  v_duration_ms int;
  v_eom_contaminated_count int := 0;
  v_eom_contaminated_amount numeric := 0;
  v_sellers_without_goal int := 0;
  v_accuracy_score numeric;
  v_run_age_min int;
  v_snap_age_hours int;
  v_run_dur int;
  v_snap_dur int;
  v_check_closed_pess boolean := true;
  v_check_order boolean := true;
  v_check_commit_le_best boolean := true;
  v_check_snap_match boolean := true;
  v_check_eom_protected boolean := true;
  v_check_sellers_with_goal boolean := true;
  v_accuracy_ready boolean := false;
BEGIN
  IF v_user_id IS NULL OR p_organization_id IS NULL THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;
  IF p_organization_id <> public.get_user_organization_id() THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;

  v_is_privileged := public.is_org_admin(p_organization_id, v_user_id)
    OR public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'manager'::app_role);

  IF NOT v_is_privileged THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;

  SELECT enabled INTO v_flag_enabled
  FROM public.feature_flags
  WHERE organization_id = p_organization_id
    AND flag_key IN ('forecast_v2_engine_enabled','enable_forecast_v2')
  ORDER BY (flag_key = 'forecast_v2_engine_enabled') DESC
  LIMIT 1;
  v_flag_enabled := COALESCE(v_flag_enabled, false);

  SELECT id, created_at, calculation_version, total_closed, total_commit, total_best_case,
         scenario_pessimistic, scenario_realistic, scenario_optimistic, scenario_best_case,
         forecast_confidence, duration_ms
    INTO v_run
  FROM public.forecast_calculation_runs
  WHERE organization_id = p_organization_id
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    AND period_start = p_period_start
    AND period_end = p_period_end
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT snapshot_date, scenario_pessimistic, scenario_realistic, scenario_optimistic,
         scenario_best_case, forecast_confidence, accuracy_score
    INTO v_snap
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    AND period_start = p_period_start
    AND period_end = p_period_end
  ORDER BY snapshot_date DESC
  LIMIT 1;

  SELECT count(*) INTO v_snap_count
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    AND period_start = p_period_start
    AND period_end = p_period_end;

  SELECT status, started_at, finished_at, error_message, duration_ms
    INTO v_job
  FROM public.forecast_snapshot_job_logs
  WHERE (organization_id IS NULL OR organization_id = p_organization_id)
  ORDER BY started_at DESC
  LIMIT 1;

  v_run_age_min := CASE WHEN v_run.created_at IS NULL THEN NULL
                   ELSE (EXTRACT(EPOCH FROM (now() - v_run.created_at))/60)::int END;
  v_snap_age_hours := CASE WHEN v_snap.snapshot_date IS NULL THEN NULL
                      ELSE (EXTRACT(EPOCH FROM (now() - v_snap.snapshot_date::timestamptz))/3600)::int END;
  v_run_dur := COALESCE(v_run.duration_ms, 0);
  v_snap_dur := COALESCE(v_job.duration_ms, 0);
  v_accuracy_score := v_snap.accuracy_score;
  v_accuracy_ready := (v_snap_count >= 5 AND v_accuracy_score IS NOT NULL);

  IF NOT v_flag_enabled THEN
    v_warnings := v_warnings || jsonb_build_object('code','feature_flag_off','message','Forecast Engine V2 está desligada para esta organização.','severity','warning');
    v_recommendations := v_recommendations || to_jsonb('Ativar a feature flag forecast_v2_engine_enabled para esta organização.'::text);
  END IF;

  IF v_run.id IS NULL THEN
    v_warnings := v_warnings || jsonb_build_object('code','no_run','message','Sem cálculo de Forecast V2 no período.','severity','warning');
    v_recommendations := v_recommendations || to_jsonb('Gerar um cálculo de Forecast agora.'::text);
  ELSE
    IF ABS(COALESCE(v_run.scenario_pessimistic,0) - (COALESCE(v_run.total_closed,0) + COALESCE(v_run.total_commit,0)*0.7)) > 1 THEN
      v_check_closed_pess := false;
      v_errors := v_errors || jsonb_build_object('code','pessimistic_mismatch','message','Pessimista não bate com fechado + commit ponderado.','severity','error');
    END IF;

    IF NOT (
      COALESCE(v_run.scenario_pessimistic,0) <= COALESCE(v_run.scenario_realistic,0) + 0.01
      AND COALESCE(v_run.scenario_realistic,0) <= COALESCE(v_run.scenario_optimistic,0) + 0.01
      AND COALESCE(v_run.scenario_optimistic,0) <= COALESCE(v_run.scenario_best_case,0) + 0.01
    ) THEN
      v_check_order := false;
      v_errors := v_errors || jsonb_build_object('code','scenarios_out_of_order','message','Cenários fora de ordem (pessimista <= realista <= otimista <= best case).','severity','error');
    END IF;

    IF COALESCE(v_run.total_commit,0) > COALESCE(v_run.scenario_best_case,0) + 1 THEN
      v_check_commit_le_best := false;
      v_errors := v_errors || jsonb_build_object('code','commit_above_best_case','message','Total de commit é maior que o cenário Best Case.','severity','error');
    END IF;

    IF v_snap.snapshot_date IS NOT NULL THEN
      IF ABS(COALESCE(v_snap.scenario_pessimistic,0) - COALESCE(v_run.scenario_pessimistic,0)) > 1
        OR ABS(COALESCE(v_snap.scenario_realistic,0) - COALESCE(v_run.scenario_realistic,0)) > 1
        OR ABS(COALESCE(v_snap.scenario_optimistic,0) - COALESCE(v_run.scenario_optimistic,0)) > 1
        OR ABS(COALESCE(v_snap.scenario_best_case,0) - COALESCE(v_run.scenario_best_case,0)) > 1
        OR ABS(COALESCE(v_snap.forecast_confidence,0) - COALESCE(v_run.forecast_confidence,0)) > 1
      THEN
        v_check_snap_match := false;
        v_warnings := v_warnings || jsonb_build_object('code','snapshot_run_mismatch','message','Snapshot mais recente não bate com o último cálculo.','severity','warning');
        v_recommendations := v_recommendations || to_jsonb('Gerar snapshot manual para sincronizar com o último cálculo.'::text);
      END IF;
    END IF;

    IF (p_period_end - current_date) <= 1 AND v_run.id IS NOT NULL THEN
      SELECT count(*), COALESCE(sum(deal_value), 0)
        INTO v_eom_contaminated_count, v_eom_contaminated_amount
      FROM public.forecast_calculation_items
      WHERE run_id = v_run.id
        AND organization_id = p_organization_id
        AND forecast_bucket = 'realistic'
        AND (
          last_activity_at IS NULL OR last_activity_at < (now() - interval '2 days')
          OR COALESCE(next_step_exists, false) = false
          OR COALESCE(nrhs_score, 0) < 70
          OR (COALESCE(adjusted_probability, 0) < 70 AND COALESCE(manual_probability, 0) < 70)
        );
      IF v_eom_contaminated_count > 0 THEN
        v_check_eom_protected := false;
        IF v_eom_contaminated_amount > COALESCE(v_run.scenario_realistic, 0) * 0.30 THEN
          v_errors := v_errors || jsonb_build_object('code','eom_realistic_contaminated','message','Mais de 30% do realista no fim do mês está contaminado.','severity','error');
        ELSE
          v_warnings := v_warnings || jsonb_build_object('code','eom_realistic_contaminated','message',format('%s deals em realistic com sinais ruins no fim do mês.', v_eom_contaminated_count),'severity','warning');
        END IF;
        v_recommendations := v_recommendations || to_jsonb('Revisar deals realistas contaminados antes do fechamento.'::text);
      END IF;
    END IF;

    SELECT count(*) INTO v_sellers_without_goal
    FROM (
      SELECT DISTINCT fci.seller_id
      FROM public.forecast_calculation_items fci
      WHERE fci.run_id = v_run.id
        AND fci.organization_id = p_organization_id
        AND fci.seller_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.sales_goals sg
          WHERE sg.user_id = fci.seller_id
            AND sg.organization_id = p_organization_id
            AND COALESCE(sg.target_value,0) > 0
            AND sg.period_start <= p_period_end
            AND sg.period_end >= p_period_start
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.seller_targets st
          WHERE st.user_id = fci.seller_id
            AND st.organization_id = p_organization_id
            AND COALESCE(st.monthly_revenue_target,0) > 0
            AND st.period_month >= date_trunc('month', p_period_start)::date
            AND st.period_month <= date_trunc('month', p_period_end)::date
        )
    ) s;
    IF v_sellers_without_goal > 0 THEN
      v_check_sellers_with_goal := false;
      v_warnings := v_warnings || jsonb_build_object('code','sellers_without_goal','message',format('%s vendedores com oportunidades estão sem meta configurada.', v_sellers_without_goal),'severity','warning');
      v_recommendations := v_recommendations || to_jsonb('Configurar metas comerciais dos vendedores impactados.'::text);
    END IF;
  END IF;

  IF v_snap_count < 5 THEN
    v_warnings := v_warnings || jsonb_build_object('code','accuracy_low_sample','message','Acurácia ainda em formação. Histórico insuficiente.','severity','warning');
    v_recommendations := v_recommendations || to_jsonb('Aguardar pelo menos 5 snapshots para acurácia confiável.'::text);
  END IF;

  IF v_run_dur > 8000 THEN
    v_errors := v_errors || jsonb_build_object('code','run_slow_critical','message',format('Cálculo de Forecast levou %sms.', v_run_dur),'severity','error');
  ELSIF v_run_dur > 3000 THEN
    v_warnings := v_warnings || jsonb_build_object('code','run_slow','message',format('Cálculo de Forecast levou %sms.', v_run_dur),'severity','warning');
  END IF;
  IF v_snap_dur > 8000 THEN
    v_errors := v_errors || jsonb_build_object('code','snapshot_slow_critical','message',format('Job de snapshot levou %sms.', v_snap_dur),'severity','error');
  ELSIF v_snap_dur > 3000 THEN
    v_warnings := v_warnings || jsonb_build_object('code','snapshot_slow','message',format('Job de snapshot levou %sms.', v_snap_dur),'severity','warning');
  END IF;

  v_consistency := jsonb_build_object(
    'closed_matches_pessimistic', v_check_closed_pess,
    'snapshot_matches_latest_run', v_check_snap_match,
    'realistic_not_above_best_case', v_check_order,
    'optimistic_not_above_best_case', v_check_order,
    'commit_not_above_best_case', v_check_commit_le_best,
    'eom_realistic_protected', v_check_eom_protected,
    'sellers_with_goal', v_check_sellers_with_goal,
    'accuracy_ready', v_accuracy_ready
  );

  IF NOT v_flag_enabled OR v_run.id IS NULL THEN
    v_status := 'not_ready';
  ELSIF jsonb_array_length(v_errors) > 0 THEN
    v_status := 'critical';
  ELSIF jsonb_array_length(v_warnings) > 0 THEN
    v_status := 'attention';
  ELSE
    v_status := 'healthy';
  END IF;

  v_duration_ms := (EXTRACT(EPOCH FROM (clock_timestamp() - v_t_start)) * 1000)::int;

  BEGIN
    INSERT INTO public.forecast_v2_health_logs(
      organization_id, pipeline_id, period_start, period_end,
      status, warnings_count, errors_count, duration_ms, metadata
    ) VALUES (
      p_organization_id, p_pipeline_id, p_period_start, p_period_end,
      v_status, jsonb_array_length(v_warnings), jsonb_array_length(v_errors),
      v_duration_ms,
      jsonb_build_object('run_id', v_run.id, 'snapshots_count', v_snap_count, 'feature_flag_enabled', v_flag_enabled)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'feature_flag_enabled', v_flag_enabled,
    'calculation_version', v_run.calculation_version,
    'latest_run_at', v_run.created_at,
    'latest_snapshot_at', v_snap.snapshot_date,
    'snapshot_job_last_status', v_job.status,
    'snapshots_count', v_snap_count,
    'accuracy_ready', v_accuracy_ready,
    'accuracy_score', v_accuracy_score,
    'seller_performance_ready', (v_run.id IS NOT NULL),
    'intelligence_ready', (v_run.id IS NOT NULL),
    'risk_center_ready', (v_run.id IS NOT NULL),
    'data_consistency', v_consistency,
    'performance', jsonb_build_object(
      'last_health_check_ms', v_duration_ms,
      'latest_run_age_minutes', v_run_age_min,
      'latest_snapshot_age_hours', v_snap_age_hours,
      'latest_run_duration_ms', v_run_dur,
      'latest_snapshot_duration_ms', v_snap_dur
    ),
    'warnings', v_warnings,
    'errors', v_errors,
    'recommendations', v_recommendations,
    'metadata', jsonb_build_object(
      'organization_id', p_organization_id,
      'pipeline_id', p_pipeline_id,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'generated_at', now()
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status','critical','error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_v2_health_check(uuid, date, date, uuid) TO authenticated;