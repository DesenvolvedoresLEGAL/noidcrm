-- Push Phase 3.2: minimal admin operations for push queue

CREATE OR REPLACE FUNCTION public.admin_retry_push_failed_jobs(
  p_organization_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(updated_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.organization_id = p_organization_id
      AND pr.role IN ('admin', 'owner', 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.push_delivery_jobs j
    JOIN public.profiles pr ON pr.id = j.user_id
    WHERE pr.organization_id = p_organization_id
      AND j.status = 'failed'
      AND j.attempts < j.max_attempts
      AND j.next_attempt_at > now()
      AND j.locked_at IS NULL
    ORDER BY j.next_attempt_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.push_delivery_jobs j
    SET next_attempt_at = now(),
        locked_at = NULL,
        processed_at = NULL
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.id
  )
  SELECT COUNT(*)::bigint FROM updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_requeue_exhausted_push_jobs(
  p_organization_id uuid,
  p_limit integer DEFAULT 25
)
RETURNS TABLE(updated_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.organization_id = p_organization_id
      AND pr.role IN ('admin', 'owner', 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.push_delivery_jobs j
    JOIN public.profiles pr ON pr.id = j.user_id
    WHERE pr.organization_id = p_organization_id
      AND j.status = 'failed'
      AND j.attempts >= j.max_attempts
      AND j.locked_at IS NULL
      AND COALESCE(j.processed_at, j.updated_at, j.created_at) <= now() - interval '30 minutes'
    ORDER BY COALESCE(j.processed_at, j.updated_at, j.created_at) DESC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.push_delivery_jobs j
    SET attempts = GREATEST(j.max_attempts - 1, 0),
        next_attempt_at = now(),
        locked_at = NULL,
        processed_at = NULL,
        last_error = CONCAT(COALESCE(NULLIF(j.last_error, ''), 'unknown'), ' | manually_requeued')
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.id
  )
  SELECT COUNT(*)::bigint FROM updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retry_push_failed_jobs(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_requeue_exhausted_push_jobs(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_retry_push_failed_jobs(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_requeue_exhausted_push_jobs(uuid, integer) TO authenticated;
