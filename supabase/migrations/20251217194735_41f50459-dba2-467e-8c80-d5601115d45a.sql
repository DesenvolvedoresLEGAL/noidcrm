-- Copiar histórico da oportunidade original 65f13e6a-1cd9-4ccd-a5ab-f2b8357c89e9 para a duplicada ce6b61f4-022e-43ee-95d3-ebff8c61c713
INSERT INTO audit_log (
  organization_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  field_name,
  old_value,
  new_value,
  metadata,
  trace_id
)
SELECT
  organization_id,
  actor_user_id,
  action,
  entity_type,
  'ce6b61f4-022e-43ee-95d3-ebff8c61c713'::uuid, -- Nova oportunidade CS
  field_name,
  old_value,
  new_value,
  jsonb_build_object(
    'copied_from_opportunity', '65f13e6a-1cd9-4ccd-a5ab-f2b8357c89e9',
    'original_created_at', created_at
  ) || COALESCE(metadata, '{}'::jsonb),
  trace_id
FROM audit_log
WHERE entity_type = 'opportunity'
  AND entity_id = '65f13e6a-1cd9-4ccd-a5ab-f2b8357c89e9'
  AND NOT EXISTS (
    -- Evita duplicação se já foi copiado
    SELECT 1 FROM audit_log al2
    WHERE al2.entity_id = 'ce6b61f4-022e-43ee-95d3-ebff8c61c713'
      AND al2.metadata->>'copied_from_opportunity' = '65f13e6a-1cd9-4ccd-a5ab-f2b8357c89e9'
      AND al2.trace_id = audit_log.trace_id
  );

-- Adicionar entrada de handoff_received na nova oportunidade se não existir
INSERT INTO audit_log (
  organization_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  metadata
)
SELECT
  o.organization_id,
  NULL,
  'handoff_received',
  'opportunity',
  'ce6b61f4-022e-43ee-95d3-ebff8c61c713',
  jsonb_build_object(
    'source_opportunity_id', '65f13e6a-1cd9-4ccd-a5ab-f2b8357c89e9',
    'source_opportunity_title', orig.title,
    'handoff_at', o.created_at
  )
FROM opportunities o
LEFT JOIN opportunities orig ON orig.id = '65f13e6a-1cd9-4ccd-a5ab-f2b8357c89e9'
WHERE o.id = 'ce6b61f4-022e-43ee-95d3-ebff8c61c713'
  AND NOT EXISTS (
    SELECT 1 FROM audit_log
    WHERE entity_id = 'ce6b61f4-022e-43ee-95d3-ebff8c61c713'
      AND action = 'handoff_received'
  );