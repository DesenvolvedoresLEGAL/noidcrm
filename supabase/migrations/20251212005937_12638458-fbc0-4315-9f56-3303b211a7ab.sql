-- Corrigir função - pipeline_id é TEXT, não UUID
DROP FUNCTION IF EXISTS get_active_opportunities_count(uuid, uuid, text);

CREATE OR REPLACE FUNCTION get_active_opportunities_count(
  p_organization_id UUID,
  p_pipeline_id TEXT DEFAULT NULL,
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
  SELECT COUNT(*)::INTEGER INTO v_count
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