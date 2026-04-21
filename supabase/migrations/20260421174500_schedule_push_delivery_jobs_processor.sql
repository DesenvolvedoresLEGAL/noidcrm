-- Push Phase 2.1: recurring processor trigger for queued push jobs
DO $$
DECLARE
  v_job_id bigint;
  v_service_role_key text;
  v_url text := 'https://urihdqturaebhiefwjnw.supabase.co/functions/v1/send-browser-push';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not available, skipping push delivery processor schedule';
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
    RAISE NOTICE 'vault secret lookup failed, skipping schedule: %', SQLERRM;
    RETURN;
  END;

  IF v_service_role_key IS NULL OR length(v_service_role_key) = 0 THEN
    RAISE NOTICE 'service role key not found in vault, skipping push schedule';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'process-push-delivery-jobs';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'process-push-delivery-jobs',
    '* * * * *',
    format(
      $fmt$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := jsonb_build_object(
          'mode', 'process',
          'limit', 25,
          'triggered_by', 'cron_push_processor',
          'at', now()
        )
      ) AS request_id;
      $fmt$,
      v_url,
      'Bearer ' || v_service_role_key
    )
  );
END $$;
