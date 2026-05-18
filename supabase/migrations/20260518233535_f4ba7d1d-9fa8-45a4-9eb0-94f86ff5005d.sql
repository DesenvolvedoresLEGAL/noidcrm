CREATE OR REPLACE FUNCTION public.report_products_sold(
  p_start date,
  p_end date,
  p_pipelines text[] DEFAULT NULL,
  p_users uuid[] DEFAULT NULL
)
RETURNS TABLE(
  product_key text,
  product_id uuid,
  name text,
  billing_type text,
  sales_count bigint,
  proposals_count bigint,
  total_quantity numeric,
  total_revenue numeric,
  avg_ticket numeric,
  share_pct numeric,
  first_sold timestamptz,
  last_sold timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(pi.product_id::text, 'name:' || lower(trim(COALESCE(pi.name, 'SEM NOME')))) AS product_key,
      pi.product_id,
      COALESCE(NULLIF(trim(pi.name), ''), 'SEM NOME') AS item_name,
      COALESCE(NULLIF(pi.billing_type, ''), 'one_time') AS item_billing_type,
      pi.proposal_id,
      COALESCE(pi.quantity, 0)::numeric AS item_quantity,
      COALESCE(pi.total, 0)::numeric AS item_total,
      o.closed_at
    FROM public.proposal_items pi
    JOIN public.proposals pr ON pr.id = pi.proposal_id
    JOIN public.opportunities o ON o.id = pr.opportunity_id
    WHERE pi.organization_id = v_org
      AND pr.organization_id = v_org
      AND o.organization_id = v_org
      AND o.deleted_at IS NULL
      AND o.status = 'won'
      AND o.closed_at IS NOT NULL
      AND o.closed_at::date BETWEEN p_start AND p_end
      AND (p_pipelines IS NULL OR array_length(p_pipelines, 1) IS NULL OR o.pipeline_id = ANY(p_pipelines))
      AND (p_users IS NULL OR array_length(p_users, 1) IS NULL OR o.owner_user_id = ANY(p_users))
  ),
  aggregated AS (
    SELECT
      b.product_key,
      (array_agg(b.product_id) FILTER (WHERE b.product_id IS NOT NULL))[1] AS product_id,
      MAX(b.item_name) AS name,
      MAX(b.item_billing_type) AS billing_type,
      COUNT(*)::bigint AS sales_count,
      COUNT(DISTINCT b.proposal_id)::bigint AS proposals_count,
      COALESCE(SUM(b.item_quantity), 0)::numeric AS total_quantity,
      COALESCE(SUM(b.item_total), 0)::numeric AS total_revenue,
      CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(b.item_total), 0) / COUNT(*), 2) ELSE 0::numeric END AS avg_ticket,
      MIN(b.closed_at) AS first_sold,
      MAX(b.closed_at) AS last_sold
    FROM base b
    GROUP BY b.product_key
  ),
  totals AS (
    SELECT NULLIF(SUM(a.total_revenue), 0) AS grand_total FROM aggregated a
  )
  SELECT
    a.product_key,
    a.product_id,
    a.name,
    a.billing_type,
    a.sales_count,
    a.proposals_count,
    a.total_quantity,
    a.total_revenue,
    a.avg_ticket,
    CASE WHEN COALESCE(t.grand_total, 0) > 0 THEN ROUND(a.total_revenue * 100.0 / t.grand_total, 2) ELSE 0::numeric END AS share_pct,
    a.first_sold,
    a.last_sold
  FROM aggregated a
  CROSS JOIN totals t
  ORDER BY a.total_revenue DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.report_products_sold(date, date, text[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_products_sold(date, date, text[], uuid[]) TO authenticated;