-- Push Phase 3: lightweight operational observability for push_delivery_jobs
CREATE OR REPLACE FUNCTION public.get_push_delivery_jobs_health(
  p_organization_id uuid,
  p_lookback_hours integer DEFAULT 24
)
RETURNS TABLE(
  snapshot_at timestamptz,
  pending_count bigint,
  processing_count bigint,
  sent_count bigint,
  failed_count bigint,
  exhausted_count bigint,
  retrying_count bigint,
  recent_failed_count bigint,
  recent_errors jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window interval := make_interval(hours => GREATEST(1, COALESCE(p_lookback_hours, 24)));
BEGIN
  -- Org + role gate (admin/owner/manager only)
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
  WITH base AS (
    SELECT j.*
    FROM public.push_delivery_jobs j
    JOIN public.profiles pr ON pr.id = j.user_id
    WHERE pr.organization_id = p_organization_id
  ),
  recent_error_agg AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('error', err, 'count', cnt)
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) AS payload
    FROM (
      SELECT
        COALESCE(NULLIF(last_error, ''), 'unknown') AS err,
        COUNT(*) AS cnt
      FROM base
      WHERE status = 'failed'
        AND COALESCE(processed_at, updated_at, created_at) >= now() - v_window
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 10
    ) e
  )
  SELECT
    now() AS snapshot_at,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending_count,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint AS processing_count,
    COUNT(*) FILTER (WHERE status = 'sent')::bigint AS sent_count,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
    COUNT(*) FILTER (WHERE status = 'failed' AND attempts >= max_attempts)::bigint AS exhausted_count,
    COUNT(*) FILTER (WHERE status = 'failed' AND attempts < max_attempts)::bigint AS retrying_count,
    COUNT(*) FILTER (
      WHERE status = 'failed'
        AND COALESCE(processed_at, updated_at, created_at) >= now() - v_window
    )::bigint AS recent_failed_count,
    rea.payload AS recent_errors
  FROM base
  CROSS JOIN recent_error_agg rea;
END;
$$;

REVOKE ALL ON FUNCTION public.get_push_delivery_jobs_health(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_push_delivery_jobs_health(uuid, integer) TO authenticated;
