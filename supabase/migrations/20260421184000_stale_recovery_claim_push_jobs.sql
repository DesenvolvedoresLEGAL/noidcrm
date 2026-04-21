-- Push Phase 2.3: recover jobs stuck in processing state
CREATE OR REPLACE FUNCTION public.claim_push_delivery_jobs(p_limit integer DEFAULT 25)
RETURNS SETOF public.push_delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
  v_stale_after interval := interval '20 minutes';
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.push_delivery_jobs j
    WHERE (
      (
        j.status IN ('pending', 'failed')
        AND j.attempts < j.max_attempts
        AND j.next_attempt_at <= now()
      )
      OR
      (
        j.status = 'processing'
        AND j.attempts < j.max_attempts
        AND j.locked_at IS NOT NULL
        AND j.locked_at <= now() - v_stale_after
      )
    )
    ORDER BY j.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.push_delivery_jobs j
    SET status = 'processing',
        locked_at = now()
    FROM picked p
    WHERE j.id = p.id
    RETURNING j.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_delivery_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery_jobs(integer) TO service_role;
