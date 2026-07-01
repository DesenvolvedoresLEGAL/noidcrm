-- Fix 1: Reschedule cron job 'activity-reminders-job' to use net.http_post instead of extensions.http_post
SELECT cron.unschedule('activity-reminders-job');

SELECT cron.schedule(
  'activity-reminders-job',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://urihdqturaebhiefwjnw.supabase.co/functions/v1/activity-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWhkcXR1cmFlYmhpZWZ3am53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDUzMDAsImV4cCI6MjA3Njk4MTMwMH0.RQ1EqUy4ARQb0RV0h83_Iw_QsXfdCCxZXXGrE2Y3Xx8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Fix 2: kairos_janitor_stale_runs references non-existent column 'completed_at' in playbook_runs.
-- Table uses finished_at as the canonical completion timestamp.
CREATE OR REPLACE FUNCTION public.kairos_janitor_stale_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
BEGIN
  WITH stale AS (
    UPDATE public.playbook_runs
    SET status = 'failed',
        error_summary = COALESCE(error_summary, 'Execução marcada como falhada pelo janitor (running > 30min sem conclusão)'),
        finished_at = now(),
        execution_time_ms = COALESCE(execution_time_ms, EXTRACT(EPOCH FROM (now() - started_at))::int * 1000)
    WHERE status = 'running'
      AND started_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*) INTO affected FROM stale;

  RETURN affected;
END;
$function$;