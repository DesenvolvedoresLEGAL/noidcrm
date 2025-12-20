
-- Corrigir funções com search_path definido para segurança
CREATE OR REPLACE FUNCTION soft_delete_opportunity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE opportunities 
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION restore_opportunity(opportunity_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE opportunities 
  SET deleted_at = NULL, updated_at = NOW()
  WHERE id = opportunity_id AND deleted_at IS NOT NULL;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION hard_delete_old_opportunities()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DROP TRIGGER IF EXISTS trigger_soft_delete_opportunity ON opportunities;
  
  DELETE FROM opportunities
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  CREATE TRIGGER trigger_soft_delete_opportunity
    BEFORE DELETE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_opportunity();
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
