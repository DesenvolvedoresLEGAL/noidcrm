-- =====================================================
-- FASE 2 PARTE 2: VIEWS PARA FORECASTING E TIMELINE
-- =====================================================

-- 1. UNIFIED TIMELINE (Activity Stream)
-- =====================================================

CREATE OR REPLACE VIEW unified_timeline AS
SELECT 
  'activity'::text as type,
  a.id,
  a.created_at as timestamp,
  a.title,
  a.type as activity_type,
  a.owner_user_id,
  a.opportunity_id,
  a.account_id,
  a.contact_id,
  a.organization_id,
  NULL::text as metadata_type,
  NULL::jsonb as metadata
FROM activities a

UNION ALL

SELECT
  'note'::text as type,
  n.id,
  n.created_at as timestamp,
  LEFT(n.content, 100) as title,
  'note'::text as activity_type,
  n.created_by as owner_user_id,
  n.opportunity_id,
  NULL::uuid as account_id,
  NULL::uuid as contact_id,
  n.organization_id,
  'note_content'::text as metadata_type,
  jsonb_build_object('content', n.content) as metadata
FROM opportunity_notes n

UNION ALL

SELECT
  'email'::text as type,
  e.id,
  e.sent_at as timestamp,
  e.subject as title,
  'email'::text as activity_type,
  e.sent_by as owner_user_id,
  e.opportunity_id,
  NULL::uuid as account_id,
  NULL::uuid as contact_id,
  e.organization_id,
  'email_data'::text as metadata_type,
  jsonb_build_object(
    'to', e.to_emails, 
    'from', e.from_email,
    'opened_count', COALESCE(e.opened_count, 0),
    'opened_at', e.opened_at
  ) as metadata
FROM opportunity_emails e

UNION ALL

SELECT
  'audit'::text as type,
  al.id,
  al.created_at as timestamp,
  al.action as title,
  al.action as activity_type,
  al.actor_user_id as owner_user_id,
  CASE 
    WHEN al.entity_type = 'opportunity' AND al.entity_id IS NOT NULL 
    THEN al.entity_id::uuid 
    ELSE NULL 
  END as opportunity_id,
  NULL::uuid as account_id,
  NULL::uuid as contact_id,
  al.organization_id,
  'audit_change'::text as metadata_type,
  jsonb_build_object(
    'entity_type', al.entity_type,
    'field_name', al.field_name,
    'old_value', al.old_value,
    'new_value', al.new_value
  ) as metadata
FROM audit_log al
WHERE al.entity_type IN ('opportunity', 'contact', 'account')
  AND al.organization_id IS NOT NULL

ORDER BY timestamp DESC;

-- 2. PIPELINE HEALTH (Forecasting Metrics)
-- =====================================================

CREATE OR REPLACE VIEW pipeline_health AS
SELECT
  o.pipeline_id,
  p.name as pipeline_name,
  s.id as stage_id,
  s.name as stage_name,
  s.order_index,
  COALESCE(s.probability, 50) as probability,
  o.organization_id,
  COUNT(o.id) as deal_count,
  SUM(COALESCE(o.valor_previsto, 0)) as total_value,
  SUM(COALESCE(o.valor_previsto, 0) * (COALESCE(s.probability, 50) / 100.0)) as weighted_value,
  AVG(EXTRACT(DAY FROM NOW() - o.created_at))::numeric as avg_age_days,
  COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - o.updated_at) > 7 THEN 1 END) as stale_deals,
  COUNT(CASE WHEN o.status = 'won' THEN 1 END) as won_deals,
  COUNT(CASE WHEN o.status = 'lost' THEN 1 END) as lost_deals
FROM opportunities o
INNER JOIN stages s ON s.id = o.stage_id
LEFT JOIN pipelines p ON p.id = o.pipeline_id
WHERE (o.status IS NULL OR o.status = 'new' OR o.status NOT IN ('won', 'lost'))
GROUP BY o.pipeline_id, p.name, s.id, s.name, s.order_index, s.probability, o.organization_id
ORDER BY o.pipeline_id, s.order_index;

-- 3. COMENTÁRIOS DOCUMENTAÇÃO
-- =====================================================

COMMENT ON VIEW unified_timeline IS 
  'Visão unificada de todas as atividades, notas, emails e mudanças de auditoria relacionadas a oportunidades, contas e contatos. Ordenado por timestamp descendente para exibir timeline cronológica.';

COMMENT ON VIEW pipeline_health IS 
  'Métricas de saúde do pipeline incluindo forecast ponderado por probabilidade, deals estagnados há mais de 7 dias, e taxas de conversão (won/lost). Usado para análise de pipeline e previsão de vendas.';