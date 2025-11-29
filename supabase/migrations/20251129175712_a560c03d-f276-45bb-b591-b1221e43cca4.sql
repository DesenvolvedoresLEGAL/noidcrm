-- =====================================================
-- FIX REMAINING SECURITY ISSUES
-- =====================================================

-- 1. Enable RLS on rate_limit_log table
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits
CREATE POLICY "System manages rate limits"
ON rate_limit_log FOR ALL
USING (false)
WITH CHECK (false);

-- 2. Review and fix all functions with mutable search_path
-- Updating critical security functions to have SET search_path

-- Fix can_view_all function
CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  );
$$;

-- Fix is_admin_or_owner function
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin')
  );
$$;

-- Fix can_view_by_team function
CREATE OR REPLACE FUNCTION public.can_view_by_team(_user_id uuid, _owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm1
    INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = _user_id AND tm2.user_id = _owner_user_id
  );
$$;

-- Fix can_view_opportunity function
CREATE OR REPLACE FUNCTION public.can_view_opportunity(_user_id uuid, _opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1 FROM opportunities
    WHERE id = _opportunity_id
      AND owner_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.opportunity_id = _opportunity_id
      AND dp.user_id = _user_id
  );
$$;

-- Fix user_is_org_member function
CREATE OR REPLACE FUNCTION public.user_is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND status = 'active'
  )
$$;

-- Fix user_is_org_admin function
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
      AND status = 'active'
  )
$$;

-- Fix get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(ps.permissions, '{}'::jsonb)
  FROM public.organization_members om
  LEFT JOIN public.permission_sets ps ON ps.id = om.permission_set_id
  WHERE om.user_id = _user_id
    AND om.status = 'active'
  LIMIT 1;
$$;

-- 3. Add comments for documentation
COMMENT ON TABLE security_audit_log IS 'Tracks all sensitive operations for security auditing and compliance';
COMMENT ON TABLE rate_limit_log IS 'Tracks API rate limiting for public endpoints to prevent abuse';
COMMENT ON FUNCTION can_view_all IS 'Security definer function to check if user has admin/manager privileges';
COMMENT ON FUNCTION can_view_opportunity IS 'Security definer function to check opportunity visibility permissions';
COMMENT ON VIEW pipeline_health IS 'Sales pipeline health metrics with security invoker for RLS inheritance';
COMMENT ON VIEW unified_timeline IS 'Unified timeline of all interactions with security invoker for RLS inheritance';