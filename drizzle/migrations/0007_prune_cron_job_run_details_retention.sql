CREATE OR REPLACE FUNCTION public.prune_log_tables()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sec integer := 0;
  v_nrhs integer := 0;
  v_cron integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.security_audit_log
    WHERE ctid IN (
      SELECT ctid FROM public.security_audit_log
      WHERE (
        (COALESCE(severity,'info') IN ('low','info','debug','warning') AND created_at < now() - interval '30 days')
        OR created_at < now() - interval '365 days'
      )
      LIMIT 500000
    )
    RETURNING 1
  ) SELECT count(*) INTO v_sec FROM del;

  WITH del2 AS (
    DELETE FROM public.nrhs_learning_signals
    WHERE ctid IN (
      SELECT ctid FROM public.nrhs_learning_signals
      WHERE created_at < now() - interval '180 days'
      LIMIT 200000
    )
    RETURNING 1
  ) SELECT count(*) INTO v_nrhs FROM del2;

  -- Histórico de execuções do agendador: mantém apenas 3 dias.
  BEGIN
    WITH del3 AS (
      DELETE FROM cron.job_run_details
      WHERE ctid IN (
        SELECT ctid FROM cron.job_run_details
        WHERE start_time < now() - interval '3 days'
        LIMIT 200000
      )
      RETURNING 1
    ) SELECT count(*) INTO v_cron FROM del3;
  EXCEPTION WHEN OTHERS THEN
    v_cron := -1;
  END;

  -- Cache descartável de respostas HTTP do pg_net.
  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '2 hours';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'security_audit_log', v_sec,
    'nrhs_learning_signals', v_nrhs,
    'cron_job_run_details', v_cron
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.prune_log_tables() FROM PUBLIC, anon, authenticated;