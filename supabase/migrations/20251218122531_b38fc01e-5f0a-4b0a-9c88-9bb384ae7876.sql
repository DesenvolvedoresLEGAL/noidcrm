-- Fase 1: Popular last_contact_date com dados históricos de atividades concluídas
UPDATE opportunities o
SET last_contact_date = subq.last_activity_date
FROM (
  SELECT 
    a.opportunity_id,
    MAX(COALESCE(a.completed_at, a.updated_at)) as last_activity_date
  FROM activities a
  WHERE a.status = 'completed'
    AND a.opportunity_id IS NOT NULL
  GROUP BY a.opportunity_id
) subq
WHERE o.id = subq.opportunity_id
  AND (o.last_contact_date IS NULL OR o.last_contact_date < subq.last_activity_date);

-- Fase 2: Criar função e trigger para manter last_contact_date atualizado automaticamente
CREATE OR REPLACE FUNCTION update_opportunity_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma atividade é completada, atualiza last_contact_date da oportunidade
  IF NEW.status = 'completed' AND NEW.opportunity_id IS NOT NULL THEN
    UPDATE opportunities 
    SET last_contact_date = GREATEST(
      COALESCE(last_contact_date, '1970-01-01'::timestamp),
      COALESCE(NEW.completed_at, NOW())
    )
    WHERE id = NEW.opportunity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trigger_update_opportunity_last_contact ON activities;

-- Criar trigger que dispara quando atividade é atualizada para status completed
CREATE TRIGGER trigger_update_opportunity_last_contact
AFTER INSERT OR UPDATE OF status ON activities
FOR EACH ROW
EXECUTE FUNCTION update_opportunity_last_contact();