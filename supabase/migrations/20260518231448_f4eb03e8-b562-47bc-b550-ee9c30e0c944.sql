
-- Relatório de Produtos & Serviços vendidos
-- Fonte canônica: proposal_items + proposals + opportunities (won, não deletadas, closed_at no período)

CREATE OR REPLACE FUNCTION public.report_products_sold(
  p_start date,
  p_end date,
  p_pipelines uuid[] DEFAULT NULL,
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
  v_grand_total numeric;
BEGIN
  v_org := public.get_user_organization_id(auth.uid());
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE _items ON COMMIT DROP AS
  SELECT
    COALESCE(pi.product_id::text, 'name:' || lower(trim(pi.name))) AS product_key,
    pi.product_id,
    -- nome canônico: prefere product_id->name, senão o nome do item
    COALESCE(
      (SELECT p2.name FROM proposal_items p2 WHERE p2.product_id = pi.product_id AND p2.product_id IS NOT NULL ORDER BY p2.created_at DESC LIMIT 1),
      pi.name
    ) AS name,
    COALESCE(pi.billing_type, 'one_time') AS billing_type,
    pi.proposal_id,
    pi.quantity,
    pi.total,
    o.closed_at
  FROM proposal_items pi
  JOIN proposals pr ON pr.id = pi.proposal_id
  JOIN opportunities o ON o.id = pr.opportunity_id
  WHERE pi.organization_id = v_org
    AND o.organization_id = v_org
    AND o.deleted_at IS NULL
    AND o.status = 'won'
    AND o.closed_at::date BETWEEN p_start AND p_end
    AND (p_pipelines IS NULL OR array_length(p_pipelines,1) IS NULL OR o.pipeline_id = ANY(p_pipelines))
    AND (p_users IS NULL OR array_length(p_users,1) IS NULL OR o.assigned_to = ANY(p_users));

  SELECT NULLIF(SUM(total),0) INTO v_grand_total FROM _items;

  RETURN QUERY
  SELECT
    i.product_key,
    MAX(i.product_id) AS product_id,
    MAX(i.name) AS name,
    MAX(i.billing_type) AS billing_type,
    COUNT(*)::bigint AS sales_count,
    COUNT(DISTINCT i.proposal_id)::bigint AS proposals_count,
    COALESCE(SUM(i.quantity),0)::numeric AS total_quantity,
    COALESCE(SUM(i.total),0)::numeric AS total_revenue,
    CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(i.total)/COUNT(*), 2) ELSE 0 END AS avg_ticket,
    CASE WHEN COALESCE(v_grand_total,0) > 0 THEN ROUND(SUM(i.total)*100.0/v_grand_total, 2) ELSE 0 END AS share_pct,
    MIN(i.closed_at) AS first_sold,
    MAX(i.closed_at) AS last_sold
  FROM _items i
  GROUP BY i.product_key
  ORDER BY total_revenue DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_products_sold(date, date, uuid[], uuid[]) TO authenticated;

-- Série mensal por produto (para sparkline / linha)
CREATE OR REPLACE FUNCTION public.report_products_monthly(
  p_start date,
  p_end date,
  p_pipelines uuid[] DEFAULT NULL,
  p_users uuid[] DEFAULT NULL,
  p_top_n int DEFAULT 5
)
RETURNS TABLE(
  product_key text,
  name text,
  month date,
  sales_count bigint,
  total_revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.get_user_organization_id(auth.uid());
  IF v_org IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(pi.product_id::text, 'name:' || lower(trim(pi.name))) AS product_key,
      pi.name,
      pi.total,
      date_trunc('month', o.closed_at)::date AS month
    FROM proposal_items pi
    JOIN proposals pr ON pr.id = pi.proposal_id
    JOIN opportunities o ON o.id = pr.opportunity_id
    WHERE pi.organization_id = v_org
      AND o.deleted_at IS NULL
      AND o.status = 'won'
      AND o.closed_at::date BETWEEN p_start AND p_end
      AND (p_pipelines IS NULL OR array_length(p_pipelines,1) IS NULL OR o.pipeline_id = ANY(p_pipelines))
      AND (p_users IS NULL OR array_length(p_users,1) IS NULL OR o.assigned_to = ANY(p_users))
  ),
  ranked AS (
    SELECT product_key, MAX(name) AS name, SUM(total) AS rev
    FROM base GROUP BY product_key
    ORDER BY rev DESC LIMIT GREATEST(p_top_n, 1)
  )
  SELECT
    b.product_key,
    r.name,
    b.month,
    COUNT(*)::bigint AS sales_count,
    SUM(b.total)::numeric AS total_revenue
  FROM base b
  JOIN ranked r ON r.product_key = b.product_key
  GROUP BY b.product_key, r.name, b.month
  ORDER BY b.month, total_revenue DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_products_monthly(date, date, uuid[], uuid[], int) TO authenticated;

-- Cross-analysis: produto x closer e produto x conta
CREATE OR REPLACE FUNCTION public.report_products_cross(
  p_start date,
  p_end date,
  p_pipelines uuid[] DEFAULT NULL,
  p_users uuid[] DEFAULT NULL
)
RETURNS TABLE(
  dimension text,         -- 'closer' | 'account' | 'pipeline'
  product_key text,
  product_name text,
  entity_id uuid,
  entity_name text,
  sales_count bigint,
  total_revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.get_user_organization_id(auth.uid());
  IF v_org IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(pi.product_id::text, 'name:' || lower(trim(pi.name))) AS product_key,
      pi.name AS product_name,
      pi.total,
      o.assigned_to,
      o.account_id,
      o.pipeline_id
    FROM proposal_items pi
    JOIN proposals pr ON pr.id = pi.proposal_id
    JOIN opportunities o ON o.id = pr.opportunity_id
    WHERE pi.organization_id = v_org
      AND o.deleted_at IS NULL
      AND o.status = 'won'
      AND o.closed_at::date BETWEEN p_start AND p_end
      AND (p_pipelines IS NULL OR array_length(p_pipelines,1) IS NULL OR o.pipeline_id = ANY(p_pipelines))
      AND (p_users IS NULL OR array_length(p_users,1) IS NULL OR o.assigned_to = ANY(p_users))
  )
  SELECT 'closer'::text, b.product_key, MAX(b.product_name), b.assigned_to,
         (SELECT pf.full_name FROM profiles pf WHERE pf.id = b.assigned_to),
         COUNT(*)::bigint, SUM(b.total)::numeric
  FROM base b WHERE b.assigned_to IS NOT NULL
  GROUP BY b.product_key, b.assigned_to
  UNION ALL
  SELECT 'account'::text, b.product_key, MAX(b.product_name), b.account_id,
         (SELECT COALESCE(a.nome_fantasia, a.razao_social, a.name) FROM accounts a WHERE a.id = b.account_id),
         COUNT(*)::bigint, SUM(b.total)::numeric
  FROM base b WHERE b.account_id IS NOT NULL
  GROUP BY b.product_key, b.account_id
  UNION ALL
  SELECT 'pipeline'::text, b.product_key, MAX(b.product_name), b.pipeline_id,
         (SELECT p.name FROM pipelines p WHERE p.id = b.pipeline_id),
         COUNT(*)::bigint, SUM(b.total)::numeric
  FROM base b WHERE b.pipeline_id IS NOT NULL
  GROUP BY b.product_key, b.pipeline_id
  ORDER BY 1, 7 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_products_cross(date, date, uuid[], uuid[]) TO authenticated;

-- Índice parcial para acelerar joins por closed_at de wons
CREATE INDEX IF NOT EXISTS idx_opportunities_won_closed_at
  ON public.opportunities (organization_id, closed_at)
  WHERE status = 'won' AND deleted_at IS NULL;
