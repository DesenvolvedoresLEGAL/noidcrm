-- =========================================================================
-- SPRINT E: Async automation hardening (final)
-- =========================================================================

-- 1) Idempotency em email_queue
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_queue')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_queue' AND column_name='dedup_key') THEN
    ALTER TABLE public.email_queue ADD COLUMN dedup_key text;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_dedup_pending
      ON public.email_queue(dedup_key)
      WHERE status = 'pending' AND dedup_key IS NOT NULL;
  END IF;
END $$;

-- 2) automation_run_log
CREATE TABLE IF NOT EXISTS public.automation_run_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  organization_id uuid,
  duration_ms  integer,
  status       text NOT NULL DEFAULT 'success',
  error_message text,
  metadata     jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_run_log_function_created
  ON public.automation_run_log (function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_run_log_org_created
  ON public.automation_run_log (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

ALTER TABLE public.automation_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_automation_run_log" ON public.automation_run_log;
CREATE POLICY "service_role_all_automation_run_log"
  ON public.automation_run_log
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins_read_automation_run_log" ON public.automation_run_log;
CREATE POLICY "admins_read_automation_run_log"
  ON public.automation_run_log
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','manager')
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup-automation-run-log') THEN
      PERFORM cron.unschedule('cleanup-automation-run-log');
    END IF;
    PERFORM cron.schedule(
      'cleanup-automation-run-log',
      '15 4 * * *',
      $cron$ DELETE FROM public.automation_run_log WHERE created_at < now() - interval '90 days'; $cron$
    );
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'cron schedule skipped: %', SQLERRM;
END $$;