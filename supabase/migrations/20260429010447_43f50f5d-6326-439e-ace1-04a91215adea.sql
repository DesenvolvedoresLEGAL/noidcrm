-- ============================================================
-- Sprint D — Travas finais: rollback, impacto e cron
-- ============================================================

-- 1. Campos de rollback nas recomendações
ALTER TABLE public.optimization_recommendations
  ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rolled_back_by UUID,
  ADD COLUMN IF NOT EXISTS rollback_payload JSONB;

-- Permitir status 'rolled_back'
ALTER TABLE public.optimization_recommendations
  DROP CONSTRAINT IF EXISTS optimization_recs_status_check;
ALTER TABLE public.optimization_recommendations
  ADD CONSTRAINT optimization_recs_status_check
    CHECK (status IN ('pending','accepted','dismissed','auto_applied','failed','rolled_back'));

-- 2. RPC: sumário de impacto (últimos 7 dias)
CREATE OR REPLACE FUNCTION public.get_optimization_impact_summary(_org_id uuid)
RETURNS TABLE (
  applied_last_7d INT,
  rolled_back_last_7d INT,
  impact_estimate_sum NUMERIC,
  pending_count INT,
  failed_last_7d INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE status IN ('accepted','auto_applied')
        AND reviewed_at >= now() - interval '7 days'
    )::int AS applied_last_7d,
    COUNT(*) FILTER (
      WHERE status = 'rolled_back'
        AND rolled_back_at >= now() - interval '7 days'
    )::int AS rolled_back_last_7d,
    COALESCE(SUM(impact_estimate) FILTER (
      WHERE status IN ('accepted','auto_applied')
        AND reviewed_at >= now() - interval '7 days'
    ), 0)::numeric AS impact_estimate_sum,
    COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
    COUNT(*) FILTER (
      WHERE status = 'failed'
        AND reviewed_at >= now() - interval '7 days'
    )::int AS failed_last_7d
  FROM public.optimization_recommendations
  WHERE organization_id = _org_id
    AND public.is_active_org_member(_org_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_optimization_impact_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_optimization_impact_summary(uuid) TO authenticated;

-- 3. RPC: rollback (marca status; reversão real é feita pela edge function)
--    Esta função é chamada PELA edge function rollback-recommendation
--    após a reversão técnica ter sido executada com sucesso.
CREATE OR REPLACE FUNCTION public.mark_recommendation_rolled_back(
  _rec_id uuid,
  _user_id uuid,
  _payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.optimization_recommendations
  WHERE id = _rec_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Recommendation not found';
  END IF;

  UPDATE public.optimization_recommendations
  SET status = 'rolled_back',
      rolled_back_at = now(),
      rolled_back_by = _user_id,
      rollback_payload = _payload
  WHERE id = _rec_id
    AND status IN ('accepted','auto_applied');

  RETURN _rec_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_recommendation_rolled_back(uuid, uuid, jsonb) FROM PUBLIC;
-- Apenas service_role pode marcar (edge function)

-- 4. Cron diário: orquestrador
DO $$
DECLARE
  v_job_id bigint;
  v_service_role_key text;
  v_url text := 'https://urihdqturaebhiefwjnw.supabase.co/functions/v1/run-optimization-cycle';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not available, skipping optimization cycle schedule';
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret
      INTO v_service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'vault secret lookup failed, skipping optimization schedule: %', SQLERRM;
    RETURN;
  END;

  IF v_service_role_key IS NULL OR length(v_service_role_key) = 0 THEN
    RAISE NOTICE 'service role key not found, skipping optimization cron';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'run-optimization-cycle-daily';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'run-optimization-cycle-daily',
    '0 4 * * *', -- 04:00 UTC diário
    format(
      $fmt$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := jsonb_build_object(
          'triggered_by', 'cron_daily',
          'at', now()
        )
      ) AS request_id;
      $fmt$,
      v_url,
      'Bearer ' || v_service_role_key
    )
  );
END $$;