-- Atualizar função restore_from_snapshot para deletar o snapshot após restauração
CREATE OR REPLACE FUNCTION public.restore_from_snapshot(p_snapshot_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot RECORD;
  v_rows_affected INTEGER;
BEGIN
  -- Buscar snapshot
  SELECT * INTO v_snapshot FROM entity_snapshots WHERE id = p_snapshot_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Snapshot not found');
  END IF;
  
  -- Restaurar baseado no tipo de entidade
  CASE v_snapshot.entity_type
    WHEN 'opportunities' THEN
      UPDATE opportunities 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      
    WHEN 'proposals' THEN
      UPDATE proposals 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      
    WHEN 'accounts' THEN
      UPDATE accounts 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      
    WHEN 'contacts' THEN
      UPDATE contacts 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      
    WHEN 'activities' THEN
      UPDATE activities 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      
    WHEN 'contracts' THEN
      UPDATE contracts 
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = v_snapshot.entity_id;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown entity type: ' || v_snapshot.entity_type);
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
  
  -- CORREÇÃO: Deletar o snapshot após restauração bem-sucedida
  DELETE FROM entity_snapshots WHERE id = p_snapshot_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'entity_type', v_snapshot.entity_type,
    'entity_id', v_snapshot.entity_id
  );
END;
$$;

-- Limpar snapshots órfãos de itens já restaurados (deleted_at IS NULL)
DELETE FROM entity_snapshots es
WHERE es.snapshot_reason = 'before_delete'
  AND es.entity_type = 'opportunities'
  AND EXISTS (
    SELECT 1 FROM opportunities o 
    WHERE o.id = es.entity_id AND o.deleted_at IS NULL
  );

DELETE FROM entity_snapshots es
WHERE es.snapshot_reason = 'before_delete'
  AND es.entity_type = 'accounts'
  AND EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.id = es.entity_id AND a.deleted_at IS NULL
  );

DELETE FROM entity_snapshots es
WHERE es.snapshot_reason = 'before_delete'
  AND es.entity_type = 'contacts'
  AND EXISTS (
    SELECT 1 FROM contacts c 
    WHERE c.id = es.entity_id AND c.deleted_at IS NULL
  );

DELETE FROM entity_snapshots es
WHERE es.snapshot_reason = 'before_delete'
  AND es.entity_type = 'activities'
  AND EXISTS (
    SELECT 1 FROM activities a 
    WHERE a.id = es.entity_id AND a.deleted_at IS NULL
  );

DELETE FROM entity_snapshots es
WHERE es.snapshot_reason = 'before_delete'
  AND es.entity_type = 'proposals'
  AND EXISTS (
    SELECT 1 FROM proposals p 
    WHERE p.id = es.entity_id AND p.deleted_at IS NULL
  );

DELETE FROM entity_snapshots es
WHERE es.snapshot_reason = 'before_delete'
  AND es.entity_type = 'contracts'
  AND EXISTS (
    SELECT 1 FROM contracts c 
    WHERE c.id = es.entity_id AND c.deleted_at IS NULL
  );