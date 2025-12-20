-- =============================================
-- FASE 1: Tabela backup_history para histórico de backups
-- =============================================
CREATE TABLE IF NOT EXISTS public.backup_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('daily', 'manual', 'before_delete', 'export')),
  entities_count JSONB DEFAULT '{}'::jsonb,
  size_bytes BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- Policies for backup_history
CREATE POLICY "Super admins can view all backups"
ON public.backup_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'super_admin'
  )
);

CREATE POLICY "Org members can view their backups"
ON public.backup_history
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

-- =============================================
-- FASE 2: Tabela deletion_alerts para notificações de deleção
-- =============================================
CREATE TABLE IF NOT EXISTS public.deletion_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_title TEXT,
  deleted_by UUID,
  deleted_by_name TEXT,
  alert_reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT false,
  read_by UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deletion_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for deletion_alerts
CREATE POLICY "Super admins can view all deletion alerts"
ON public.deletion_alerts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'super_admin'
  )
);

CREATE POLICY "Org admins can view their deletion alerts"
ON public.deletion_alerts
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update deletion alerts"
ON public.deletion_alerts
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'super_admin')
  )
);

-- =============================================
-- FASE 3: Função de Rate Limiting de Deleções
-- =============================================
CREATE OR REPLACE FUNCTION public.check_deletion_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_deletions INT;
  rate_limit INT := 10;
  time_window INTERVAL := '5 minutes';
BEGIN
  -- Count recent deletions by this user
  SELECT COUNT(*) INTO recent_deletions
  FROM public.audit_log
  WHERE actor_user_id = auth.uid()
    AND action = 'deleted'
    AND created_at > NOW() - time_window;
  
  IF recent_deletions >= rate_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum % deletions per % allowed. Please wait before deleting more items.', rate_limit, time_window;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply rate limiting trigger to critical tables
DROP TRIGGER IF EXISTS check_deletion_rate_opportunities ON public.opportunities;
CREATE TRIGGER check_deletion_rate_opportunities
  BEFORE DELETE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.check_deletion_rate_limit();

DROP TRIGGER IF EXISTS check_deletion_rate_proposals ON public.proposals;
CREATE TRIGGER check_deletion_rate_proposals
  BEFORE DELETE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_deletion_rate_limit();

DROP TRIGGER IF EXISTS check_deletion_rate_accounts ON public.accounts;
CREATE TRIGGER check_deletion_rate_accounts
  BEFORE DELETE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_deletion_rate_limit();

DROP TRIGGER IF EXISTS check_deletion_rate_contacts ON public.contacts;
CREATE TRIGGER check_deletion_rate_contacts
  BEFORE DELETE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_deletion_rate_limit();

-- =============================================
-- FASE 4: Função para criar alerta de deleção crítica
-- =============================================
CREATE OR REPLACE FUNCTION public.create_deletion_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_title TEXT;
  v_alert_reason TEXT;
  v_severity TEXT := 'medium';
  v_user_name TEXT;
  v_entity_value NUMERIC;
BEGIN
  -- Get user name
  SELECT full_name INTO v_user_name 
  FROM profiles WHERE user_id = auth.uid();

  -- Determine entity title and check for critical conditions
  IF TG_TABLE_NAME = 'opportunities' THEN
    v_entity_title := OLD.title;
    v_entity_value := COALESCE(OLD.value, 0);
    
    -- High value opportunity
    IF v_entity_value > 10000 THEN
      v_severity := 'high';
      v_alert_reason := format('Oportunidade de alto valor (R$ %s) deletada', v_entity_value);
    ELSE
      v_alert_reason := 'Oportunidade deletada';
    END IF;
    
  ELSIF TG_TABLE_NAME = 'proposals' THEN
    v_entity_title := COALESCE(OLD.proposal_number, OLD.title, 'Proposta');
    v_alert_reason := 'Proposta deletada';
    
  ELSIF TG_TABLE_NAME = 'accounts' THEN
    v_entity_title := COALESCE(OLD.razao_social, OLD.nome_fantasia);
    v_severity := 'high';
    v_alert_reason := 'Empresa deletada';
    
  ELSIF TG_TABLE_NAME = 'contacts' THEN
    v_entity_title := OLD.nome;
    v_alert_reason := 'Contato deletado';
  END IF;

  -- Create the alert
  INSERT INTO public.deletion_alerts (
    organization_id,
    entity_type,
    entity_id,
    entity_title,
    deleted_by,
    deleted_by_name,
    alert_reason,
    severity
  ) VALUES (
    OLD.organization_id,
    TG_TABLE_NAME,
    OLD.id,
    v_entity_title,
    auth.uid(),
    v_user_name,
    v_alert_reason,
    v_severity
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply deletion alert trigger to critical tables
DROP TRIGGER IF EXISTS create_deletion_alert_opportunities ON public.opportunities;
CREATE TRIGGER create_deletion_alert_opportunities
  AFTER DELETE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deletion_alert();

DROP TRIGGER IF EXISTS create_deletion_alert_proposals ON public.proposals;
CREATE TRIGGER create_deletion_alert_proposals
  AFTER DELETE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deletion_alert();

DROP TRIGGER IF EXISTS create_deletion_alert_accounts ON public.accounts;
CREATE TRIGGER create_deletion_alert_accounts
  AFTER DELETE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deletion_alert();

DROP TRIGGER IF EXISTS create_deletion_alert_contacts ON public.contacts;
CREATE TRIGGER create_deletion_alert_contacts
  AFTER DELETE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deletion_alert();

-- =============================================
-- FASE 5: Função de backup completo
-- =============================================
CREATE OR REPLACE FUNCTION public.create_organization_backup(p_organization_id UUID, p_backup_type TEXT DEFAULT 'manual')
RETURNS UUID AS $$
DECLARE
  v_backup_id UUID;
  v_entities_count JSONB;
  v_opportunities_count INT;
  v_proposals_count INT;
  v_accounts_count INT;
  v_contacts_count INT;
  v_activities_count INT;
BEGIN
  -- Create backup record
  INSERT INTO public.backup_history (organization_id, backup_type, status, created_by)
  VALUES (p_organization_id, p_backup_type, 'in_progress', auth.uid())
  RETURNING id INTO v_backup_id;

  -- Count entities
  SELECT COUNT(*) INTO v_opportunities_count FROM opportunities WHERE organization_id = p_organization_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_proposals_count FROM proposals WHERE organization_id = p_organization_id;
  SELECT COUNT(*) INTO v_accounts_count FROM accounts WHERE organization_id = p_organization_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_contacts_count FROM contacts WHERE organization_id = p_organization_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_activities_count FROM activities WHERE organization_id = p_organization_id AND deleted_at IS NULL;

  -- Create snapshots for all entities
  INSERT INTO public.entity_snapshots (organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by, expires_at)
  SELECT organization_id, 'opportunities', id, to_jsonb(o.*), 'backup_' || p_backup_type, auth.uid(), NOW() + INTERVAL '90 days'
  FROM opportunities o WHERE organization_id = p_organization_id AND deleted_at IS NULL;

  INSERT INTO public.entity_snapshots (organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by, expires_at)
  SELECT organization_id, 'proposals', id, to_jsonb(p.*), 'backup_' || p_backup_type, auth.uid(), NOW() + INTERVAL '90 days'
  FROM proposals p WHERE organization_id = p_organization_id;

  INSERT INTO public.entity_snapshots (organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by, expires_at)
  SELECT organization_id, 'accounts', id, to_jsonb(a.*), 'backup_' || p_backup_type, auth.uid(), NOW() + INTERVAL '90 days'
  FROM accounts a WHERE organization_id = p_organization_id AND deleted_at IS NULL;

  INSERT INTO public.entity_snapshots (organization_id, entity_type, entity_id, snapshot_data, snapshot_reason, created_by, expires_at)
  SELECT organization_id, 'contacts', id, to_jsonb(c.*), 'backup_' || p_backup_type, auth.uid(), NOW() + INTERVAL '90 days'
  FROM contacts c WHERE organization_id = p_organization_id AND deleted_at IS NULL;

  -- Update backup record with counts
  v_entities_count := jsonb_build_object(
    'opportunities', v_opportunities_count,
    'proposals', v_proposals_count,
    'accounts', v_accounts_count,
    'contacts', v_contacts_count,
    'activities', v_activities_count
  );

  UPDATE public.backup_history
  SET status = 'completed',
      entities_count = v_entities_count,
      completed_at = NOW()
  WHERE id = v_backup_id;

  RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- FASE 6: Proteção do Audit Log (Imutabilidade)
-- =============================================
-- Prevent updates to audit_log
CREATE POLICY "Audit log is immutable - no updates"
ON public.audit_log
FOR UPDATE
USING (false);

-- Prevent deletes from audit_log
CREATE POLICY "Audit log is immutable - no deletes"
ON public.audit_log
FOR DELETE
USING (false);

-- =============================================
-- FASE 7: Índices para performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_backup_history_org_id ON public.backup_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON public.backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_alerts_org_id ON public.deletion_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_deletion_alerts_is_read ON public.deletion_alerts(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_deletion_alerts_created_at ON public.deletion_alerts(created_at DESC);

-- Enable realtime for deletion_alerts (for live notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.deletion_alerts;