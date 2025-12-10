-- Corrigir pipeline_type do PRÉ VENDAS da Humanoid para 'qualification'
UPDATE pipelines 
SET pipeline_type = 'qualification'
WHERE name ILIKE '%pré%vendas%' 
  AND pipeline_type = 'sales';

-- Corrigir a oportunidade existente (WiFi LEGAL) - vincular ao pipeline PRÉ VENDAS correto
UPDATE opportunities o
SET 
  pipeline_id = p.id,
  stage_id = (SELECT s.id FROM stages s WHERE s.pipeline_id = p.id ORDER BY s.order_index LIMIT 1)
FROM pipelines p
WHERE o.id = '8f260a0e-6ff0-481b-8217-3892ceb139d3'
  AND p.organization_id = o.organization_id
  AND p.name ILIKE '%pré%vendas%';