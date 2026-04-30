
-- ============================================================
-- Sprint F2.2 — Forecast Daily Snapshots
-- ============================================================

-- 1) Tabela de snapshots diários
CREATE TABLE IF NOT EXISTS public.forecast_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL,
  pipeline_id uuid NULL,
  snapshot_date date NOT NULL,

  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly',

  seller_id uuid NULL,

  run_id uuid NULL REFERENCES public.forecast_calculation_runs(id) ON DELETE SET NULL,

  monthly_goal numeric DEFAULT 0,

  closed_amount numeric DEFAULT 0,
  commit_amount numeric DEFAULT 0,
  best_case_amount numeric DEFAULT 0,

  scenario_pessimistic numeric DEFAULT 0,
  scenario_realistic numeric DEFAULT 0,
  scenario_optimistic numeric DEFAULT 0,
  scenario_best_case numeric DEFAULT 0,

  pipeline_total numeric DEFAULT 0,

  forecast_confidence numeric DEFAULT 0,
  nrhs_avg numeric DEFAULT 0,
  data_quality_score numeric DEFAULT 0,

  deals_count integer DEFAULT 0,
  included_deals_count integer DEFAULT 0,
  excluded_deals_count integer DEFAULT 0,
  risk_deals_count integer DEFAULT 0,
  slipping_deals_count integer DEFAULT 0,

  no_recent_activity_count integer DEFAULT 0,
  no_next_step_count integer DEFAULT 0,
  expired_close_date_count integer DEFAULT 0,
  low_nrhs_count integer DEFAULT 0,

  closed_won_final_amount numeric NULL,

  forecast_error_amount numeric NULL,
  forecast_error_percentage numeric NULL,
  accuracy_score numeric NULL,

  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_forecast_daily_snapshots_org_date
  ON public.forecast_daily_snapshots (organization_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_forecast_daily_snapshots_org_pipeline_period
  ON public.forecast_daily_snapshots (organization_id, pipeline_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_forecast_daily_snapshots_seller
  ON public.forecast_daily_snapshots (organization_id, seller_id, snapshot_date DESC);

-- Único por escopo (com COALESCE para tratar NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS uq_forecast_daily_snapshot_scope
  ON public.forecast_daily_snapshots (
    organization_id,
    COALESCE(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid),
    snapshot_date,
    period_start,
    period_end,
    COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 2) Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_forecast_daily_snapshots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forecast_daily_snapshots_updated_at ON public.forecast_daily_snapshots;

CREATE TRIGGER trg_forecast_daily_snapshots_updated_at
BEFORE UPDATE ON public.forecast_daily_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.set_forecast_daily_snapshots_updated_at();

-- 3) RLS
ALTER TABLE public.forecast_daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fds_select" ON public.forecast_daily_snapshots;
CREATE POLICY "fds_select" ON public.forecast_daily_snapshots
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR seller_id IS NULL
    OR seller_id = auth.uid()
  )
);

-- INSERT/UPDATE somente via SECURITY DEFINER (RPC) ou service role.
DROP POLICY IF EXISTS "fds_insert_admin" ON public.forecast_daily_snapshots;
CREATE POLICY "fds_insert_admin" ON public.forecast_daily_snapshots
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "fds_update_admin" ON public.forecast_daily_snapshots;
CREATE POLICY "fds_update_admin" ON public.forecast_daily_snapshots
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- 4) Tabela de logs de job
CREATE TABLE IF NOT EXISTS public.forecast_snapshot_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  pipeline_id uuid NULL,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz NULL,
  status text NOT NULL DEFAULT 'running',
  snapshots_attempted integer DEFAULT 0,
  snapshots_created integer DEFAULT 0,
  snapshots_failed integer DEFAULT 0,
  error_message text NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecast_snapshot_job_logs_started
  ON public.forecast_snapshot_job_logs (started_at DESC);

ALTER TABLE public.forecast_snapshot_job_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fsjl_select_admin" ON public.forecast_snapshot_job_logs;
CREATE POLICY "fsjl_select_admin" ON public.forecast_snapshot_job_logs
FOR SELECT
TO authenticated
USING (
  (organization_id IS NULL OR organization_id = public.get_user_organization_id())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

DROP POLICY IF EXISTS "fsjl_insert_block" ON public.forecast_snapshot_job_logs;
CREATE POLICY "fsjl_insert_block" ON public.forecast_snapshot_job_logs
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 5) RPC: create_forecast_daily_snapshot_v2
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
  -- Validação de acesso (service role => v_caller IS NULL, permitido)
  IF v_caller IS NOT NULL THEN
    SELECT public.get_user_organization_id() INTO v_caller_org;
    IF v_caller_org IS DISTINCT FROM p_organization_id
       AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
      RAISE EXCEPTION 'forbidden: organization mismatch';
    END IF;
  END IF;

  -- Executa a auditoria
  v_audit_result := public.calculate_forecast_audit_v2(
    p_organization_id,
    p_pipeline_id,
    p_period_start,
    p_period_end,
    p_seller_id
  );

  v_run_id := NULLIF(v_audit_result->>'run_id', '')::uuid;

  IF v_run_id IS NULL THEN
    RAISE EXCEPTION 'forecast audit did not return a run_id';
  END IF;

  -- Carrega o run
  SELECT * INTO v_run FROM public.forecast_calculation_runs WHERE id = v_run_id;

  -- Contagens complementares a partir dos items
  SELECT
    COUNT(*) FILTER (WHERE last_activity_at IS NULL OR last_activity_at < (now() - interval '7 days')),
    COUNT(*) FILTER (WHERE COALESCE(next_step_exists, false) = false),
    COUNT(*) FILTER (WHERE close_date IS NOT NULL AND close_date < current_date AND eligibility_status <> 'excluded'),
    COUNT(*) FILTER (WHERE COALESCE(nrhs_score, 0) < 60)
  INTO v_no_recent, v_no_next, v_expired, v_low_nrhs
  FROM public.forecast_calculation_items
  WHERE run_id = v_run_id;

  -- Upsert
  INSERT INTO public.forecast_daily_snapshots (
    organization_id, pipeline_id, snapshot_date,
    period_start, period_end, period_type,
    seller_id, run_id,
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
    p_seller_id, v_run_id,
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
    jsonb_build_object('source', 'create_forecast_daily_snapshot_v2')
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

-- 6) RPC: get_forecast_snapshots_v2
CREATE OR REPLACE FUNCTION public.get_forecast_snapshots_v2(
  p_organization_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL
)
RETURNS TABLE (
  snapshot_id uuid,
  snapshot_date date,
  period_start date,
  period_end date,
  period_type text,
  seller_id uuid,
  monthly_goal numeric,
  closed_amount numeric,
  commit_amount numeric,
  best_case_amount numeric,
  scenario_pessimistic numeric,
  scenario_realistic numeric,
  scenario_optimistic numeric,
  scenario_best_case numeric,
  pipeline_total numeric,
  forecast_confidence numeric,
  nrhs_avg numeric,
  data_quality_score numeric,
  deals_count integer,
  included_deals_count integer,
  excluded_deals_count integer,
  risk_deals_count integer,
  slipping_deals_count integer,
  no_recent_activity_count integer,
  no_next_step_count integer,
  expired_close_date_count integer,
  low_nrhs_count integer,
  accuracy_score numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.snapshot_date,
    s.period_start,
    s.period_end,
    s.period_type,
    s.seller_id,
    s.monthly_goal,
    s.closed_amount,
    s.commit_amount,
    s.best_case_amount,
    s.scenario_pessimistic,
    s.scenario_realistic,
    s.scenario_optimistic,
    s.scenario_best_case,
    s.pipeline_total,
    s.forecast_confidence,
    s.nrhs_avg,
    s.data_quality_score,
    s.deals_count,
    s.included_deals_count,
    s.excluded_deals_count,
    s.risk_deals_count,
    s.slipping_deals_count,
    s.no_recent_activity_count,
    s.no_next_step_count,
    s.expired_close_date_count,
    s.low_nrhs_count,
    s.accuracy_score,
    s.created_at
  FROM public.forecast_daily_snapshots s
  WHERE s.organization_id = p_organization_id
    AND (p_pipeline_id IS NULL OR s.pipeline_id IS NOT DISTINCT FROM p_pipeline_id)
    AND (p_period_start IS NULL OR s.period_start = p_period_start)
    AND (p_period_end IS NULL OR s.period_end = p_period_end)
    AND (p_seller_id IS NULL OR s.seller_id IS NOT DISTINCT FROM p_seller_id)
  ORDER BY s.snapshot_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_snapshots_v2(uuid, uuid, date, date, uuid) TO authenticated, service_role;
