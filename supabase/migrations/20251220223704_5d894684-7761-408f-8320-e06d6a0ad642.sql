
-- Adicionar coluna deleted_at para Soft Delete
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar índice para performance nas queries
CREATE INDEX IF NOT EXISTS idx_opportunities_deleted_at ON opportunities(deleted_at) WHERE deleted_at IS NULL;

-- Criar função para soft delete
CREATE OR REPLACE FUNCTION soft_delete_opportunity()
RETURNS TRIGGER AS $$
BEGIN
  -- Em vez de deletar, apenas marca como deletado
  UPDATE opportunities 
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = OLD.id;
  
  -- Retorna NULL para cancelar o DELETE original
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger BEFORE DELETE para interceptar deleções
DROP TRIGGER IF EXISTS trigger_soft_delete_opportunity ON opportunities;
CREATE TRIGGER trigger_soft_delete_opportunity
  BEFORE DELETE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_opportunity();

-- Criar função para restaurar oportunidade deletada
CREATE OR REPLACE FUNCTION restore_opportunity(opportunity_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE opportunities 
  SET deleted_at = NULL, updated_at = NOW()
  WHERE id = opportunity_id AND deleted_at IS NOT NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para hard delete (limpeza após 30 dias)
CREATE OR REPLACE FUNCTION hard_delete_old_opportunities()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Deletar oportunidades que estão no lixo há mais de 30 dias
  -- Primeiro remove o trigger temporariamente
  DROP TRIGGER IF EXISTS trigger_soft_delete_opportunity ON opportunities;
  
  DELETE FROM opportunities
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Recria o trigger
  CREATE TRIGGER trigger_soft_delete_opportunity
    BEFORE DELETE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_opportunity();
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar comentário explicativo
COMMENT ON COLUMN opportunities.deleted_at IS 'Soft delete: quando não nulo, indica que a oportunidade foi deletada e quando. Oportunidades deletadas ficam no "lixo" por 30 dias.';
