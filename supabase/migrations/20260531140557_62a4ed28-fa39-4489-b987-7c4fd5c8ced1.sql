CREATE OR REPLACE VIEW public.v_report_forecast_v2 AS
WITH base AS (
  SELECT
    r.organization_id,
    r.pipeline_id AS primary_pipeline_id,
    r.status,
    r.commercial_amount_current,
    r.close_date_prevista,
    COALESCE(s.probability, 0)::numeric / 100.0 AS prob_factor
  FROM public.v_reporting_opportunities_v2 r
  LEFT JOIN public.stages s ON s.id = r.stage_id
  WHERE r.pipeline_is_primary = true AND r.pipeline_type = 'sales'
),
closed_net AS (
  SELECT
    organization_id,
    COALESCE(SUM(
      COALESCE(valid_revenue_amount, CASE WHEN is_cancelled_sale THEN 0 ELSE commercial_amount END)
    ), 0)::numeric AS closed_revenue
  FROM public.commercial_won_revenue_view
  WHERE pipeline_type = 'sales'
  GROUP BY organization_id
)
SELECT
  b.organization_id,
  MAX(b.primary_pipeline_id) AS primary_pipeline_id,
  COALESCE(MAX(cn.closed_revenue), 0)::numeric AS closed_revenue,
  COALESCE(SUM(b.commercial_amount_current) FILTER (
    WHERE b.status <> ALL (ARRAY['won','lost'])
  ), 0)::numeric AS open_pipeline_value,
  COALESCE(SUM(b.commercial_amount_current * b.prob_factor) FILTER (
    WHERE b.status <> ALL (ARRAY['won','lost'])
  ), 0)::numeric AS weighted_pipeline_value,
  COALESCE(MAX(os.monthly_revenue_goal), 0)::numeric AS monthly_revenue_goal,
  COALESCE(MAX(os.quarterly_revenue_goal), 0)::numeric AS quarterly_revenue_goal,
  COALESCE(MAX(os.annual_revenue_goal), 0)::numeric AS annual_revenue_goal,
  ROUND(
    COUNT(*) FILTER (
      WHERE b.status <> ALL (ARRAY['won','lost'])
        AND b.commercial_amount_current > 0
        AND b.close_date_prevista IS NOT NULL
    )::numeric
    / NULLIF(COUNT(*) FILTER (WHERE b.status <> ALL (ARRAY['won','lost'])), 0)::numeric
    * 100, 2
  ) AS forecast_reliability_pct
FROM base b
LEFT JOIN public.organization_settings os ON os.organization_id = b.organization_id
LEFT JOIN closed_net cn ON cn.organization_id = b.organization_id
GROUP BY b.organization_id;

ALTER VIEW public.v_report_forecast_v2 SET (security_invoker = on);