-- =====================================================
-- SECURITY FIXES: Secure Views + Table Policies
-- =====================================================

-- 1. Recreate pipeline_health view with security_invoker
DROP VIEW IF EXISTS pipeline_health;

CREATE VIEW pipeline_health 
WITH (security_invoker = true)
AS
SELECT 
  p.id as pipeline_id,
  p.name as pipeline_name,
  s.id as stage_id,
  s.name as stage_name,
  s.order_index,
  s.probability,
  o.organization_id,
  COUNT(DISTINCT o.id) as deal_count,
  COALESCE(SUM(o.valor_previsto), 0) as total_value,
  COALESCE(SUM(o.valor_previsto * s.probability / 100.0), 0) as weighted_value,
  COALESCE(AVG(EXTRACT(DAY FROM (now() - o.created_at))), 0) as avg_age_days,
  COUNT(DISTINCT CASE WHEN o.days_since_contact > 30 THEN o.id END) as stale_deals,
  COUNT(DISTINCT CASE WHEN o.status = 'won' THEN o.id END) as won_deals,
  COUNT(DISTINCT CASE WHEN o.status = 'lost' THEN o.id END) as lost_deals
FROM pipelines p
CROSS JOIN stages s
LEFT JOIN opportunities o ON o.pipeline_id = p.id AND o.stage_id = s.id
WHERE p.id = s.pipeline_id
GROUP BY p.id, p.name, s.id, s.name, s.order_index, s.probability, o.organization_id;

-- 2. Recreate unified_timeline view with security_invoker (simplified)
DROP VIEW IF EXISTS unified_timeline;

CREATE VIEW unified_timeline
WITH (security_invoker = true)
AS
-- Activities
SELECT 
  'activity' as type,
  a.id,
  a.scheduled_date as timestamp,
  a.title,
  a.type as activity_type,
  a.owner_user_id,
  a.opportunity_id,
  a.account_id,
  a.contact_id,
  a.organization_id,
  NULL as metadata_type,
  jsonb_build_object(
    'status', a.status,
    'description', a.description
  ) as metadata
FROM activities a

UNION ALL

-- Notes
SELECT 
  'note' as type,
  n.id,
  n.created_at as timestamp,
  'Nota adicionada' as title,
  'note' as activity_type,
  NULL as owner_user_id,
  n.opportunity_id,
  NULL as account_id,
  NULL as contact_id,
  n.organization_id,
  NULL as metadata_type,
  jsonb_build_object('content', n.content) as metadata
FROM opportunity_notes n

UNION ALL

-- Emails
SELECT 
  'email' as type,
  e.id,
  e.sent_at as timestamp,
  e.subject as title,
  'email' as activity_type,
  NULL as owner_user_id,
  e.opportunity_id,
  NULL as account_id,
  NULL as contact_id,
  e.organization_id,
  NULL as metadata_type,
  jsonb_build_object('sent_at', e.sent_at) as metadata
FROM opportunity_emails e

UNION ALL

-- Audit logs
SELECT 
  'audit' as type,
  al.id,
  al.created_at as timestamp,
  al.action as title,
  'audit' as activity_type,
  al.actor_user_id as owner_user_id,
  CASE WHEN al.entity_type = 'opportunity' THEN al.entity_id::uuid END as opportunity_id,
  CASE WHEN al.entity_type = 'account' THEN al.entity_id::uuid END as account_id,
  CASE WHEN al.entity_type = 'contact' THEN al.entity_id::uuid END as contact_id,
  al.organization_id,
  al.entity_type as metadata_type,
  jsonb_build_object(
    'field_name', al.field_name,
    'action', al.action
  ) as metadata
FROM audit_log al;

-- 3. Strengthen profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their org" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users view profiles in their org only"
ON profiles FOR SELECT
USING (organization_id = get_user_organization_id() OR user_id = auth.uid());

CREATE POLICY "Users update only own profile"
ON profiles FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Strengthen accounts policies
DROP POLICY IF EXISTS "Users can view all accounts" ON accounts;
DROP POLICY IF EXISTS "Users can view org accounts" ON accounts;
DROP POLICY IF EXISTS "Users view accounts based on role" ON accounts;
DROP POLICY IF EXISTS "Users view accounts based on role and ownership" ON accounts;

CREATE POLICY "Users view accounts by role and ownership"
ON accounts FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (can_view_all(auth.uid()) OR owner_user_id = auth.uid() OR cs_user_id = auth.uid())
);

-- 5. Strengthen contacts policies
DROP POLICY IF EXISTS "Public can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users view contacts based on role" ON contacts;
DROP POLICY IF EXISTS "Users view contacts based on role and account ownership" ON contacts;

CREATE POLICY "Users view contacts by role and account"
ON contacts FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (
    can_view_all(auth.uid())
    OR EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = contacts.account_id
      AND (a.owner_user_id = auth.uid() OR a.cs_user_id = auth.uid())
    )
  )
);

-- 6. Strengthen proposals policies
DROP POLICY IF EXISTS "Anyone with token can view proposal" ON proposals;
DROP POLICY IF EXISTS "Public proposals viewable with token" ON proposals;
DROP POLICY IF EXISTS "Org members view proposals based on role" ON proposals;
DROP POLICY IF EXISTS "Users can view proposals in their org" ON proposals;
DROP POLICY IF EXISTS "Clients view proposals via valid token" ON proposals;
DROP POLICY IF EXISTS "Org members view proposals based on visibility" ON proposals;

CREATE POLICY "Public token proposal access"
ON proposals FOR SELECT
USING (public_token IS NOT NULL AND status IN ('sent', 'viewed', 'accepted', 'rejected'));

CREATE POLICY "Org members view their proposals"
ON proposals FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (
    can_view_all(auth.uid())
    OR EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = proposals.opportunity_id
      AND can_view_opportunity(auth.uid(), o.id)
    )
  )
);

-- 7. Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid REFERENCES organizations(id),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  ip_address inet,
  user_agent text,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view security logs"
ON security_audit_log FOR SELECT
USING (user_is_org_admin(organization_id));

CREATE POLICY "System inserts security logs"
ON security_audit_log FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_security_audit_org_created 
ON security_audit_log(organization_id, created_at DESC);

-- 8. Audit trigger
CREATE OR REPLACE FUNCTION log_sensitive_operation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_severity text := 'info';
BEGIN
  IF TG_OP = 'DELETE' THEN v_severity := 'warning';
  ELSIF TG_TABLE_NAME IN ('proposals', 'contracts') THEN v_severity := 'warning';
  END IF;

  INSERT INTO security_audit_log (
    user_id, organization_id, action, entity_type, entity_id, severity, metadata
  ) VALUES (
    auth.uid(),
    COALESCE(NEW.organization_id, OLD.organization_id),
    TG_OP || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    v_severity,
    jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP)
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_proposals_changes ON proposals;
CREATE TRIGGER audit_proposals_changes AFTER UPDATE OR DELETE ON proposals
FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

DROP TRIGGER IF EXISTS audit_opportunities_changes ON opportunities;
CREATE TRIGGER audit_opportunities_changes AFTER UPDATE OR DELETE ON opportunities
FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

DROP TRIGGER IF EXISTS audit_accounts_changes ON accounts;
CREATE TRIGGER audit_accounts_changes AFTER UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

-- 9. Rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  blocked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup 
ON rate_limit_log(identifier, endpoint, window_start DESC);