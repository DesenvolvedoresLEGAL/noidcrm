-- Recover the stuck FISPAL FOOD run from May 11 so the user can retry from the UI.
UPDATE public.playbook_runs
SET status = 'failed',
    finished_at = COALESCE(finished_at, now()),
    error_summary = 'Recuperado: timeout silencioso após Swapcard extrair 462 expositores. Pipeline corrigido (AI loop pulado quando provider determinístico entrega lista completa). Abrir nova busca.'
WHERE id = 'e6d2f0b4-b9f4-403e-bb1e-39761269b6d6'
  AND status = 'running';

-- Stale-run watchdog: marks any sourcing run as 'failed' once it has been
-- 'running' without a heartbeat for 15+ minutes (or with no heartbeat at all
-- and started 15+ minutes ago). Prevents zombie rows from blocking the UI.
CREATE OR REPLACE FUNCTION public.mark_stale_playbook_runs_failed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH stale AS (
    UPDATE public.playbook_runs
       SET status = 'failed',
           finished_at = now(),
           error_summary = COALESCE(error_summary,
             'Execução interrompida por timeout (sem heartbeat há 15 min). Abrir nova busca para tentar novamente.')
     WHERE status = 'running'
       AND (
            (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < now() - interval '15 minutes')
         OR (last_heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < now() - interval '15 minutes')
         OR (last_heartbeat_at IS NULL AND started_at IS NULL AND created_at < now() - interval '15 minutes')
       )
     RETURNING 1
  )
  SELECT count(*) INTO affected FROM stale;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stale_playbook_runs_failed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_stale_playbook_runs_failed() TO authenticated, service_role;

-- Schedule the watchdog every 5 minutes via pg_cron (extension is already enabled).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('mark-stale-playbook-runs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-stale-playbook-runs');
    PERFORM cron.schedule(
      'mark-stale-playbook-runs',
      '*/5 * * * *',
      $cron$ SELECT public.mark_stale_playbook_runs_failed(); $cron$
    );
  END IF;
END $$;