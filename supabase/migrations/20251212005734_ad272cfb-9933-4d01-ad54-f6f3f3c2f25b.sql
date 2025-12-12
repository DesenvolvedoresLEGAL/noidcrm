-- 1. Criar função centralizada para contagem de oportunidades ativas
CREATE OR REPLACE FUNCTION get_active_opportunities_count(
  p_organization_id UUID,
  p_pipeline_id UUID DEFAULT NULL,
  p_pipeline_type TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM opportunities o
  INNER JOIN stages s ON o.stage_id = s.id AND s.pipeline_id = o.pipeline_id
  INNER JOIN pipelines p ON o.pipeline_id = p.id
  WHERE o.organization_id = p_organization_id
    AND o.status NOT IN ('won', 'lost')
    AND (p_pipeline_id IS NULL OR o.pipeline_id = p_pipeline_id)
    AND (p_pipeline_type IS NULL OR p.pipeline_type = p_pipeline_type);
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 2. Criar função de validação de stage
CREATE OR REPLACE FUNCTION validate_opportunity_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só valida se ambos stage_id e pipeline_id estão preenchidos
  IF NEW.stage_id IS NOT NULL AND NEW.pipeline_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM stages 
      WHERE id = NEW.stage_id 
      AND pipeline_id = NEW.pipeline_id
    ) THEN
      RAISE EXCEPTION 'stage_id (%) must belong to pipeline_id (%). Stage belongs to different pipeline.', 
        NEW.stage_id, NEW.pipeline_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Criar trigger de validação
DROP TRIGGER IF EXISTS validate_opportunity_stage_trigger ON opportunities;
CREATE TRIGGER validate_opportunity_stage_trigger
BEFORE INSERT OR UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION validate_opportunity_stage();

-- 4. Corrigir a oportunidade órfã HOLTEC PHARMA - mover para primeiro stage do ALUGUE: VENDAS
UPDATE opportunities 
SET stage_id = (
  SELECT s.id 
  FROM stages s
  INNER JOIN pipelines p ON s.pipeline_id = p.id
  WHERE p.id = opportunities.pipeline_id
  ORDER BY s.order_index ASC
  LIMIT 1
)
WHERE id = '22cd0821-c2f8-4dec-82fa-ff0e6c16d45c';

-- 5. Verificar e corrigir outras oportunidades órfãs na organização
UPDATE opportunities o
SET stage_id = (
  SELECT s.id 
  FROM stages s
  WHERE s.pipeline_id = o.pipeline_id
  ORDER BY s.order_index ASC
  LIMIT 1
)
WHERE o.organization_id = 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d'
  AND o.stage_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stages s 
    WHERE s.id = o.stage_id 
    AND s.pipeline_id = o.pipeline_id
  );