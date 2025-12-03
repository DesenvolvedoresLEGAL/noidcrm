-- View de conversão por estágio do funil
CREATE OR REPLACE VIEW public.stage_conversion_metrics WITH (security_invoker = true) AS
WITH stage_counts AS (
  SELECT 
    p.id as pipeline_id,
    p.name as pipeline_name,
    p.pipeline_type,
    p.organization_id,
    s.id as stage_id,
    s.name as stage_name,
    s.order_index,
    COUNT(DISTINCT o.id) as opportunities_count,
    COALESCE(SUM(o.valor_previsto), 0) as stage_value
  FROM pipelines p
  JOIN stages s ON s.pipeline_id = p.id
  LEFT JOIN opportunities o ON o.stage_id = s.id AND o.status IS NULL
  GROUP BY p.id, p.name, p.pipeline_type, p.organization_id, s.id, s.name, s.order_index
),
stage_with_next AS (
  SELECT 
    *,
    LEAD(opportunities_count) OVER (PARTITION BY pipeline_id ORDER BY order_index DESC) as next_stage_count
  FROM stage_counts
)
SELECT 
  pipeline_id,
  pipeline_name,
  pipeline_type,
  organization_id,
  stage_id,
  stage_name,
  order_index,
  opportunities_count,
  stage_value,
  CASE 
    WHEN opportunities_count > 0 AND next_stage_count IS NOT NULL
    THEN ROUND((next_stage_count::numeric / opportunities_count::numeric) * 100, 1)
    ELSE NULL
  END as conversion_rate_to_next
FROM stage_with_next
ORDER BY pipeline_id, order_index;

-- View de métricas de handoff SDR → Closer
CREATE OR REPLACE VIEW public.handoff_metrics WITH (security_invoker = true) AS
SELECT 
  o.qualified_by_user_id as sdr_user_id,
  sdr_profile.full_name as sdr_name,
  o.owner_user_id as closer_user_id,
  closer_profile.full_name as closer_name,
  o.organization_id,
  COUNT(*) as total_handoffs,
  COUNT(*) FILTER (WHERE o.status = 'won') as won_after_handoff,
  COUNT(*) FILTER (WHERE o.status = 'lost') as lost_after_handoff,
  COUNT(*) FILTER (WHERE o.status IS NULL OR o.status = 'open') as active_after_handoff,
  COALESCE(SUM(o.valor_previsto) FILTER (WHERE o.status = 'won'), 0) as revenue_from_handoffs,
  CASE 
    WHEN COUNT(*) FILTER (WHERE o.status IN ('won', 'lost')) > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE o.status = 'won')::numeric / 
          COUNT(*) FILTER (WHERE o.status IN ('won', 'lost'))::numeric) * 100, 1)
    ELSE 0
  END as handoff_win_rate,
  COALESCE(AVG(
    EXTRACT(EPOCH FROM (o.qualified_at - o.created_at)) / 3600
  ), 0) as avg_qualification_hours
FROM opportunities o
JOIN pipelines p ON o.pipeline_id = p.id
LEFT JOIN profiles sdr_profile ON o.qualified_by_user_id = sdr_profile.user_id
LEFT JOIN profiles closer_profile ON o.owner_user_id = closer_profile.user_id
WHERE o.source_opportunity_id IS NOT NULL
  AND o.qualified_by_user_id IS NOT NULL
  AND p.pipeline_type = 'sales'
GROUP BY 
  o.qualified_by_user_id, 
  sdr_profile.full_name, 
  o.owner_user_id, 
  closer_profile.full_name, 
  o.organization_id;