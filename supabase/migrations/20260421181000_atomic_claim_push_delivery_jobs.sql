-- Push Phase 2.2: atomic claim for concurrent processor safety
CREATE OR REPLACE FUNCTION public.claim_push_delivery_jobs(p_limit integer DEFAULT 25)
RETURNS SETOF public.push_delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.push_delivery_jobs j
    WHERE j.status IN ('pending', 'failed')
      AND j.attempts < j.max_attempts
      AND j.next_attempt_at <= now()
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
