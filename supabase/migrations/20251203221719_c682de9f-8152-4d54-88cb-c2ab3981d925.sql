-- Corrigir Security Definer nas views (usar SECURITY INVOKER)

-- Recriar view pipeline_metrics com security_invoker
DROP VIEW IF EXISTS public.pipeline_metrics;
CREATE VIEW public.pipeline_metrics 
WITH (security_invoker = true)
AS
SELECT 
  p.id as pipeline_id,
  p.name as pipeline_name,
  p.pipeline_type,
  p.organization_id,
  COUNT(o.id) as total_opportunities,
  COUNT(CASE WHEN o.status = 'won' THEN 1 END) as won_count,
  COUNT(CASE WHEN o.status = 'lost' THEN 1 END) as lost_count,
  COUNT(CASE WHEN o.status IS NULL OR o.status NOT IN ('won', 'lost') THEN 1 END) as active_count,
  COALESCE(SUM(o.valor_previsto), 0) as total_value,
  COALESCE(SUM(CASE WHEN o.status = 'won' THEN o.valor_previsto ELSE 0 END), 0) as won_value,
  COALESCE(AVG(CASE WHEN o.status = 'won' THEN o.valor_previsto END), 0) as avg_won_value,
  ROUND(
    CASE 
      WHEN COUNT(CASE WHEN o.status IN ('won', 'lost') THEN 1 END) > 0 
      THEN COUNT(CASE WHEN o.status = 'won' THEN 1 END)::NUMERIC / 
           COUNT(CASE WHEN o.status IN ('won', 'lost') THEN 1 END) * 100
      ELSE 0 
    END, 2
  ) as win_rate
FROM pipelines p
LEFT JOIN opportunities o ON o.pipeline_id = p.id
GROUP BY p.id, p.name, p.pipeline_type, p.organization_id;

-- Recriar view sdr_performance com security_invoker
DROP VIEW IF EXISTS public.sdr_performance;
CREATE VIEW public.sdr_performance 
WITH (security_invoker = true)
AS
SELECT 
  o.qualified_by_user_id as sdr_user_id,
  pr.full_name as sdr_name,
  o.organization_id,
  COUNT(DISTINCT o.id) as total_sqls_generated,
  COUNT(DISTINCT CASE WHEN o.status = 'won' THEN o.id END) as deals_won,
  COUNT(DISTINCT CASE WHEN o.status = 'lost' THEN o.id END) as deals_lost,
  COALESCE(SUM(CASE WHEN o.status = 'won' THEN o.valor_previsto ELSE 0 END), 0) as revenue_attributed,
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN o.status IN ('won', 'lost') THEN o.id END) > 0 
      THEN COUNT(DISTINCT CASE WHEN o.status = 'won' THEN o.id END)::NUMERIC / 
           COUNT(DISTINCT CASE WHEN o.status IN ('won', 'lost') THEN o.id END) * 100
      ELSE 0 
    END, 2
  ) as conversion_rate,
  AVG(EXTRACT(EPOCH FROM (o.qualified_at - source.created_at)) / 3600)::NUMERIC(10,2) as avg_qualification_hours
FROM opportunities o
LEFT JOIN profiles pr ON pr.user_id = o.qualified_by_user_id
LEFT JOIN opportunities source ON source.id = o.source_opportunity_id
WHERE o.qualified_by_user_id IS NOT NULL
GROUP BY o.qualified_by_user_id, pr.full_name, o.organization_id;