-- Função que sincroniza prob com stage.probability
CREATE OR REPLACE FUNCTION public.sync_opportunity_probability()
RETURNS TRIGGER AS $$
DECLARE
  stage_prob INTEGER;
BEGIN
  -- Buscar a probabilidade da etapa
  SELECT probability INTO stage_prob
  FROM stages
  WHERE id = NEW.stage_id;
  
  -- Se a etapa tiver probabilidade definida, sincronizar
  IF stage_prob IS NOT NULL THEN
    NEW.prob := stage_prob;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Trigger que dispara em INSERT ou UPDATE de stage_id
DROP TRIGGER IF EXISTS sync_prob_on_stage_change ON opportunities;
CREATE TRIGGER sync_prob_on_stage_change
  BEFORE INSERT OR UPDATE OF stage_id ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_opportunity_probability();

-- Corrigir dados existentes: sincronizar prob de todas as oportunidades com a probabilidade da etapa atual
UPDATE opportunities o
SET prob = s.probability
FROM stages s
WHERE o.stage_id = s.id
  AND s.probability IS NOT NULL
  AND (o.prob IS NULL OR o.prob != s.probability);