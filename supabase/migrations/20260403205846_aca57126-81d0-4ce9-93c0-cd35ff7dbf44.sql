
-- Atualizar títulos existentes
UPDATE opportunities SET title = upper(title) WHERE title IS NOT NULL;

-- Trigger para forçar maiúsculas
CREATE OR REPLACE FUNCTION uppercase_opportunity_title()
RETURNS trigger AS $$
BEGIN
  NEW.title := upper(NEW.title);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_opportunity_title_upper
BEFORE INSERT OR UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION uppercase_opportunity_title();
