-- ============================================
-- SISTEMA DE BACKUP E RECUPERAÇÃO ROBUSTO
-- ============================================

-- 1. Adicionar deleted_at para soft delete em tabelas críticas
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Criar tabela de snapshots para backup completo
CREATE TABLE IF NOT EXISTS entity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  snapshot_data JSONB NOT NULL,
  snapshot_reason TEXT NOT NULL DEFAULT 'before_delete',
  related_entities JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_snapshots_entity ON entity_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_org_date ON entity_snapshots(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_expires ON entity_snapshots(expires_at) WHERE expires_at IS NOT NULL;

-- 3. Adicionar coluna full_entity_data ao audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS full_entity_data JSONB;

-- 4. Habilitar RLS na tabela de snapshots
ALTER TABLE entity_snapshots ENABLE ROW LEVEL SECURITY;

-- Política: usuários só podem ver snapshots da sua organização
CREATE POLICY "Users can view own org snapshots" ON entity_snapshots
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Política: sistema pode inserir snapshots
CREATE POLICY "System can insert snapshots" ON entity_snapshots
  FOR INSERT WITH CHECK (true);

-- 5. Função genérica para criar snapshot antes de delete
CREATE OR REPLACE FUNCTION create_snapshot_before_delete()
RETURNS trigger AS $$
BEGIN
  INSERT INTO entity_snapshots (
    organization_id,
    entity_type,
    entity_id,
    snapshot_data,
    snapshot_reason,
    created_by
  )
  VALUES (
    OLD.organization_id,
    TG_TABLE_NAME,
    OLD.id,
    to_jsonb(OLD),
    'before_delete',
    auth.uid()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Função de soft delete para proposals
CREATE OR REPLACE FUNCTION soft_delete_proposal()
RETURNS trigger AS $$
BEGIN
  -- Criar snapshot antes de "deletar"
  INSERT INTO entity_snapshots (
    organization_id,
    entity_type,
    entity_id,
    snapshot_data,
    snapshot_reason,
    created_by
  )
  VALUES (
    OLD.organization_id,
    'proposals',
    OLD.id,
    to_jsonb(OLD),
    'before_delete',
    auth.uid()
  );
  
  -- Soft delete: apenas marca como deletado
  UPDATE proposals 
  SET deleted_at = NOW(), updated_at = NOW() 
  WHERE id = OLD.id;
  
  -- Registrar no audit log
  INSERT INTO audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    full_entity_data
  )
  VALUES (
    OLD.organization_id,
    auth.uid(),
    'proposal_deleted',
    'proposal',
    OLD.id,
    to_jsonb(OLD)
  );
  
  RETURN NULL; -- Cancela o DELETE real
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Função de soft delete para accounts
CREATE OR REPLACE FUNCTION soft_delete_account()
RETURNS trigger AS $$
BEGIN
  INSERT INTO entity_snapshots (
    organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by
  )
  VALUES (OLD.organization_id, 'accounts', OLD.id, to_jsonb(OLD), 'before_delete', auth.uid());
  
  UPDATE accounts SET deleted_at = NOW(), updated_at = NOW() WHERE id = OLD.id;
  
  INSERT INTO audit_log (organization_id, actor_user_id, action, entity_type, entity_id, full_entity_data)
  VALUES (OLD.organization_id, auth.uid(), 'account_deleted', 'account', OLD.id, to_jsonb(OLD));
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Função de soft delete para contacts
CREATE OR REPLACE FUNCTION soft_delete_contact()
RETURNS trigger AS $$
BEGIN
  INSERT INTO entity_snapshots (
    organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by
  )
  VALUES (OLD.organization_id, 'contacts', OLD.id, to_jsonb(OLD), 'before_delete', auth.uid());
  
  UPDATE contacts SET deleted_at = NOW(), updated_at = NOW() WHERE id = OLD.id;
  
  INSERT INTO audit_log (organization_id, actor_user_id, action, entity_type, entity_id, full_entity_data)
  VALUES (OLD.organization_id, auth.uid(), 'contact_deleted', 'contact', OLD.id, to_jsonb(OLD));
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Função de soft delete para activities
CREATE OR REPLACE FUNCTION soft_delete_activity()
RETURNS trigger AS $$
BEGIN
  INSERT INTO entity_snapshots (
    organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by
  )
  VALUES (OLD.organization_id, 'activities', OLD.id, to_jsonb(OLD), 'before_delete', auth.uid());
  
  UPDATE activities SET deleted_at = NOW(), updated_at = NOW() WHERE id = OLD.id;
  
  INSERT INTO audit_log (organization_id, actor_user_id, action, entity_type, entity_id, full_entity_data)
  VALUES (OLD.organization_id, auth.uid(), 'activity_deleted', 'activity', OLD.id, to_jsonb(OLD));
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Função de soft delete para contracts
CREATE OR REPLACE FUNCTION soft_delete_contract()
RETURNS trigger AS $$
BEGIN
  INSERT INTO entity_snapshots (
    organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by
  )
  VALUES (OLD.organization_id, 'contracts', OLD.id, to_jsonb(OLD), 'before_delete', auth.uid());
  
  UPDATE contracts SET deleted_at = NOW(), updated_at = NOW() WHERE id = OLD.id;
  
  INSERT INTO audit_log (organization_id, actor_user_id, action, entity_type, entity_id, full_entity_data)
  VALUES (OLD.organization_id, auth.uid(), 'contract_deleted', 'contract', OLD.id, to_jsonb(OLD));
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. Atualizar função de soft delete para opportunities (já existe, melhorar)
CREATE OR REPLACE FUNCTION soft_delete_opportunity()
RETURNS trigger AS $$
DECLARE
  related_data JSONB;
BEGIN
  -- Coletar dados relacionados (propostas, atividades)
  SELECT jsonb_build_object(
    'proposals', COALESCE((
      SELECT jsonb_agg(to_jsonb(p))
      FROM proposals p WHERE p.opportunity_id = OLD.id AND p.deleted_at IS NULL
    ), '[]'::jsonb),
    'activities', COALESCE((
      SELECT jsonb_agg(to_jsonb(a))
      FROM activities a WHERE a.opportunity_id = OLD.id AND a.deleted_at IS NULL
    ), '[]'::jsonb)
  ) INTO related_data;

  -- Criar snapshot com dados relacionados
  INSERT INTO entity_snapshots (
    organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, related_entities, created_by
  )
  VALUES (
    OLD.organization_id, 'opportunities', OLD.id, to_jsonb(OLD), 'before_delete', related_data, auth.uid()
  );
  
  -- Soft delete
  UPDATE opportunities SET deleted_at = NOW(), updated_at = NOW() WHERE id = OLD.id;
  
  -- Audit log com dados completos
  INSERT INTO audit_log (organization_id, actor_user_id, action, entity_type, entity_id, full_entity_data, metadata)
  VALUES (
    OLD.organization_id, auth.uid(), 'opportunity_deleted', 'opportunity', OLD.id, 
    to_jsonb(OLD), related_data
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 12. Criar/Recriar triggers
DROP TRIGGER IF EXISTS soft_delete_opportunity_trigger ON opportunities;
CREATE TRIGGER soft_delete_opportunity_trigger
  BEFORE DELETE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_opportunity();

DROP TRIGGER IF EXISTS soft_delete_proposal_trigger ON proposals;
CREATE TRIGGER soft_delete_proposal_trigger
  BEFORE DELETE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_proposal();

DROP TRIGGER IF EXISTS soft_delete_account_trigger ON accounts;
CREATE TRIGGER soft_delete_account_trigger
  BEFORE DELETE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_account();

DROP TRIGGER IF EXISTS soft_delete_contact_trigger ON contacts;
CREATE TRIGGER soft_delete_contact_trigger
  BEFORE DELETE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_contact();

DROP TRIGGER IF EXISTS soft_delete_activity_trigger ON activities;
CREATE TRIGGER soft_delete_activity_trigger
  BEFORE DELETE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_activity();

DROP TRIGGER IF EXISTS soft_delete_contract_trigger ON contracts;
CREATE TRIGGER soft_delete_contract_trigger
  BEFORE DELETE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_contract();

-- 13. Função para restaurar entidade do snapshot
CREATE OR REPLACE FUNCTION restore_from_snapshot(
  p_snapshot_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_snapshot RECORD;
  v_result JSONB;
BEGIN
  -- Buscar snapshot
  SELECT * INTO v_snapshot FROM entity_snapshots WHERE id = p_snapshot_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Snapshot not found');
  END IF;
  
  -- Restaurar baseado no tipo
  CASE v_snapshot.entity_type
    WHEN 'opportunities' THEN
      UPDATE opportunities 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      
    WHEN 'proposals' THEN
      UPDATE proposals 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      
    WHEN 'accounts' THEN
      UPDATE accounts 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      
    WHEN 'contacts' THEN
      UPDATE contacts 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      
    WHEN 'activities' THEN
      UPDATE activities 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      
    WHEN 'contracts' THEN
      UPDATE contracts 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown entity type');
  END CASE;
  
  -- Registrar restauração no audit log
  INSERT INTO audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_snapshot.organization_id,
    COALESCE(p_user_id, auth.uid()),
    'entity_restored',
    v_snapshot.entity_type,
    v_snapshot.entity_id,
    jsonb_build_object('snapshot_id', p_snapshot_id, 'restored_at', NOW())
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'entity_type', v_snapshot.entity_type,
    'entity_id', v_snapshot.entity_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 14. Função para limpar snapshots expirados (para cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM entity_snapshots 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;