-- Fix playbook_metrics view to use security invoker
DROP VIEW IF EXISTS playbook_metrics;
CREATE VIEW playbook_metrics WITH (security_invoker = true) AS
SELECT 
  p.id as playbook_id,
  p.organization_id,
  p.name,
  p.category,
  p.version,
  p.is_active,
  p.auto_disabled,
  p.estimated_hours,
  p.roi_threshold,
  p.min_sample_size,
  COUNT(e.id) as total_executions,
  COUNT(CASE WHEN e.outcome = 'success' THEN 1 END) as successful_executions,
  COUNT(CASE WHEN e.converted THEN 1 END) as converted_deals,
  ROUND(
    COUNT(CASE WHEN e.converted THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(e.id), 0) * 100, 2
  ) as calc_conversion_rate,
  SUM(COALESCE(e.revenue_generated, 0)) as total_revenue,
  SUM(COALESCE(e.cost_hours, 0)) as total_hours,
  ROUND(
    SUM(COALESCE(e.revenue_generated, 0)) / 
    NULLIF(SUM(COALESCE(e.cost_hours, 0)), 0), 2
  ) as roi_per_hour,
  ROUND(AVG(e.cycle_time_days), 1) as avg_cycle_days,
  ROUND(AVG(e.effectiveness_rating), 2) as avg_rating,
  COUNT(CASE WHEN e.started_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_executions,
  COUNT(CASE WHEN e.started_at >= NOW() - INTERVAL '30 days' AND e.converted THEN 1 END) as recent_conversions
FROM ai_playbooks p
LEFT JOIN playbook_executions e ON e.playbook_id = p.id
GROUP BY p.id, p.organization_id, p.name, p.category, p.version, p.is_active, 
         p.auto_disabled, p.estimated_hours, p.roi_threshold, p.min_sample_size;