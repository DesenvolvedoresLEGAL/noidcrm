-- Fase 7 & 8: Limpeza de dados e trigger para integridade futura

-- Preencher closed_at para oportunidades won que não tem
UPDATE opportunities 
SET closed_at = updated_at 
WHERE status = 'won' 
  AND closed_at IS NULL;

-- Preencher closed_at para oportunidades lost que não tem  
UPDATE opportunities 
SET closed_at = updated_at 
WHERE status = 'lost' 
  AND closed_at IS NULL;

-- Criar função para setar closed_at automaticamente
CREATE OR REPLACE FUNCTION public.set_closed_at_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') AND (OLD.status IS NULL OR OLD.status NOT IN ('won', 'lost')) THEN
    NEW.closed_at := COALESCE(NEW.closed_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_set_closed_at ON opportunities;
CREATE TRIGGER trg_set_closed_at
BEFORE UPDATE ON opportunities
FOR EACH ROW
EXECUTE FUNCTION public.set_closed_at_on_status_change();