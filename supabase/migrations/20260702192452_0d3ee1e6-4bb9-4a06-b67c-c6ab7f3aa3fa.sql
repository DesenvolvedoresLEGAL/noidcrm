-- KAI.15.3 — Corrige "aguardando infinito" no Revelar telefone.
UPDATE public.enriched_contact_profiles
SET
  phone_reveal_status = 'not_found',
  phone_revealed = false,
  phone_source_type = COALESCE(phone_source_type, 'unknown'),
  phone_quality_reason = COALESCE(phone_quality_reason, 'resolved_stuck_requested'),
  updated_at = now()
WHERE phone_reveal_status IN ('requested','awaiting','pending')
  AND (last_reveal_attempt_at IS NULL OR last_reveal_attempt_at < now() - interval '2 minutes');

UPDATE public.apollo_reveal_audit
SET status = 'not_found',
    reason = COALESCE(reason, 'resolved_stuck_requested')
WHERE status IN ('pending','requested','awaiting')
  AND created_at < now() - interval '2 minutes';

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
      phone_reveal_status = 'not_found',
      phone_revealed = false,
      phone_source_type = COALESCE(phone_source_type, 'unknown'),
      phone_quality_reason = COALESCE(phone_quality_reason, 'resolved_stuck_requested'),
      updated_at = now()
    WHERE phone_reveal_status IN ('requested','awaiting','pending')
      AND (last_reveal_attempt_at IS NULL OR last_reveal_attempt_at < now() - interval '2 minutes')
    RETURNING id
  )
  SELECT count(*) INTO affected FROM stale;

  UPDATE public.apollo_reveal_audit
  SET status = 'not_found',
      reason = COALESCE(reason, 'resolved_stuck_requested')
  WHERE status IN ('pending','requested','awaiting')
    AND created_at < now() - interval '2 minutes';

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_phone_reveal_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_phone_reveal_requests() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('cleanup_stale_phone_reveal_requests')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup_stale_phone_reveal_requests');
    PERFORM cron.schedule(
      'cleanup_stale_phone_reveal_requests',
      '* * * * *',
      $cron$ SELECT public.cleanup_stale_phone_reveal_requests(); $cron$
    );
  END IF;
END $$;