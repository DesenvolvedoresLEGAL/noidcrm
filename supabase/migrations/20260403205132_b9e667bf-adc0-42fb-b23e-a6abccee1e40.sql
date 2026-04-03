
-- Adicionar novas colunas
ALTER TABLE contacts ADD COLUMN primeiro_nome text;
ALTER TABLE contacts ADD COLUMN ultimo_nome text;

-- Migrar dados existentes
UPDATE contacts SET
  primeiro_nome = split_part(nome, ' ', 1),
  ultimo_nome = CASE 
    WHEN position(' ' in nome) > 0 
    THEN substring(nome from position(' ' in nome) + 1)
    ELSE ''
  END;

-- Tornar primeiro_nome obrigatório
ALTER TABLE contacts ALTER COLUMN primeiro_nome SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN primeiro_nome SET DEFAULT '';
ALTER TABLE contacts ALTER COLUMN ultimo_nome SET DEFAULT '';

-- Trigger para manter nome sincronizado
CREATE OR REPLACE FUNCTION update_contact_nome()
RETURNS trigger AS $$
BEGIN
  NEW.nome := trim(NEW.primeiro_nome || ' ' || coalesce(NEW.ultimo_nome, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_nome
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION update_contact_nome();
