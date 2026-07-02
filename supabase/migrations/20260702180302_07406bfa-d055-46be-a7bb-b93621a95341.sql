
-- KAI.15.1 HOTFIX — Phone reveal terminal state guarantee
-- 1) Backfill stuck contacts (phone_reveal_status in requested/awaiting/pending >10min)
UPDATE public.enriched_contact_profiles
SET
  phone_reveal_status = 'failed',
  phone_revealed = false,
  phone_source_type = COALESCE(phone_source_type, 'unknown'),
  updated_at = now()
WHERE phone_reveal_status IN ('requested','awaiting','pending')
  AND (last_reveal_attempt_at IS NULL OR last_reveal_attempt_at < now() - interval '10 minutes');

-- Close matching pending audits
UPDATE public.apollo_reveal_audit
SET status = 'failed',
    reason = COALESCE(reason, 'stale_pending_cleanup')
WHERE status IN ('pending','requested','awaiting')
  AND created_at < now() - interval '10 minutes';

-- 2) Periodic cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_stale_phone_reveal_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH stale AS (
    UPDATE public.enriched_contact_profiles
    SET
      phone_reveal_status = 'failed',
      phone_revealed = false,
      phone_source_type = COALESCE(phone_source_type, 'unknown'),
      updated_at = now()
    WHERE phone_reveal_status IN ('requested','awaiting','pending')
      AND (last_reveal_attempt_at IS NULL OR last_reveal_attempt_at < now() - interval '10 minutes')
    RETURNING id
  )
  SELECT count(*) INTO affected FROM stale;

  UPDATE public.apollo_reveal_audit
  SET status = 'failed', reason = COALESCE(reason,'stale_pending_cleanup')
  WHERE status IN ('pending','requested','awaiting')
    AND created_at < now() - interval '10 minutes';

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_phone_reveal_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_phone_reveal_requests() TO service_role;

-- 3) Schedule every 5 minutes via pg_cron (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('cleanup_stale_phone_reveal_requests')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup_stale_phone_reveal_requests');
    PERFORM cron.schedule(
      'cleanup_stale_phone_reveal_requests',
      '*/5 * * * *',
      $cron$ SELECT public.cleanup_stale_phone_reveal_requests(); $cron$
    );
  END IF;
END $$;
