-- View de performance de Closers (vendedores que fecham deals)
CREATE OR REPLACE VIEW public.closer_performance WITH (security_invoker = true) AS
SELECT 
  o.owner_user_id as closer_user_id,
  p.full_name as closer_name,
  o.organization_id,
  COUNT(*) FILTER (WHERE o.status = 'won') as deals_won,
  COUNT(*) FILTER (WHERE o.status = 'lost') as deals_lost,
  COUNT(*) FILTER (WHERE o.status IS NULL OR o.status = 'open') as deals_active,
  COALESCE(SUM(o.valor_previsto) FILTER (WHERE o.status = 'won'), 0) as revenue_closed,
  COALESCE(SUM(o.valor_previsto) FILTER (WHERE o.status IS NULL OR o.status = 'open'), 0) as pipeline_value,
  COALESCE(AVG(o.valor_previsto) FILTER (WHERE o.status = 'won'), 0) as avg_deal_size,
  CASE 
    WHEN COUNT(*) FILTER (WHERE o.status IN ('won', 'lost')) > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE o.status = 'won')::numeric / 
          COUNT(*) FILTER (WHERE o.status IN ('won', 'lost'))::numeric) * 100, 1)
    ELSE 0
  END as win_rate,
  COALESCE(AVG(
    EXTRACT(EPOCH FROM (
      CASE WHEN o.status = 'won' THEN o.updated_at ELSE NULL END - o.created_at
    )) / 86400
  ) FILTER (WHERE o.status = 'won'), 0) as avg_sales_cycle_days
FROM opportunities o
JOIN pipelines pl ON o.pipeline_id = pl.id
LEFT JOIN profiles p ON o.owner_user_id = p.user_id
WHERE pl.pipeline_type = 'sales'
GROUP BY o.owner_user_id, p.full_name, o.organization_id;