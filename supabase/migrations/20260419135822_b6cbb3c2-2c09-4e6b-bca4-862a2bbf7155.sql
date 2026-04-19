
-- PHASE 1: Trigger to keep profile.email synced from auth.users when NULL
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_email_trigger ON public.profiles;
CREATE TRIGGER profiles_sync_email_trigger
BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email_from_auth();

UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id
  AND (p.email IS NULL OR p.email = '');

-- PHASE 2: Schedule cron jobs (extensions already installed)
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'build-daily-digest-hourly';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;

  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'build-daily-digest-catchup';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END $$;

SELECT cron.schedule(
  'build-daily-digest-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://urihdqturaebhiefwjnw.supabase.co/functions/v1/build-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWhkcXR1cmFlYmhpZWZ3am53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDUzMDAsImV4cCI6MjA3Njk4MTMwMH0.RQ1EqUy4ARQb0RV0h83_Iw_QsXfdCCxZXXGrE2Y3Xx8'
    ),
    body := jsonb_build_object('triggered_by', 'cron_hourly', 'at', now())
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'build-daily-digest-catchup',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://urihdqturaebhiefwjnw.supabase.co/functions/v1/build-daily-digest?ignore_hour=1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWhkcXR1cmFlYmhpZWZ3am53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDUzMDAsImV4cCI6MjA3Njk4MTMwMH0.RQ1EqUy4ARQb0RV0h83_Iw_QsXfdCCxZXXGrE2Y3Xx8'
    ),
    body := jsonb_build_object('triggered_by', 'cron_catchup', 'at', now())
  ) AS request_id;
  $$
);

-- PHASE 3: Admin observability RPC
CREATE OR REPLACE FUNCTION public.get_daily_digest_cron_status()
RETURNS TABLE(
  job_name text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_run_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    (SELECT jr.start_time FROM cron.job_run_details jr WHERE jr.jobid = j.jobid ORDER BY jr.start_time DESC LIMIT 1),
    (SELECT jr.status::text FROM cron.job_run_details jr WHERE jr.jobid = j.jobid ORDER BY jr.start_time DESC LIMIT 1)
  FROM cron.job j
  WHERE j.jobname LIKE 'build-daily-digest%';
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_digest_cron_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_digest_cron_status() TO authenticated;
