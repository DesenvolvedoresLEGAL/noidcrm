-- Migration 6c: Recreate unblock_trial with security validation
-- Phase 2 Security Fixes

-- Drop and recreate with proper security validation
DROP FUNCTION IF EXISTS public.unblock_trial(uuid, uuid, text);

CREATE FUNCTION public.unblock_trial(
  org_id uuid,
  by_user_id uuid,
  reason text DEFAULT 'upgrade'::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get the caller's user ID
  v_caller_id := auth.uid();
  
  -- Check if caller is null (anonymous)
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Check if caller is a platform admin
  IF public.is_platform_admin(v_caller_id) THEN
    v_is_authorized := true;
  END IF;
  
  -- Check if caller is an admin of this organization
  IF NOT v_is_authorized THEN
    SELECT EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = org_id
        AND ou.user_id = v_caller_id
        AND ou.role IN ('owner', 'admin')
    ) INTO v_is_authorized;
  END IF;
  
  -- If not authorized, raise exception
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: Only organization admins or platform admins can unblock trials';
  END IF;
  
  -- Original logic
  UPDATE public.trial_blocks
  SET unblocked_at = now(),
      unblocked_by = by_user_id,
      unblocked_reason = reason
  WHERE organization_id = org_id AND unblocked_at IS NULL;
  
  UPDATE public.organizations
  SET status = 'active'
  WHERE id = org_id;
  
  RETURN true;
END;
$$;

-- Revoke EXECUTE from anon
REVOKE EXECUTE ON FUNCTION public.unblock_trial(uuid, uuid, text) FROM anon;

COMMENT ON FUNCTION public.unblock_trial(uuid, uuid, text) IS 
'Unblocks trial for an organization. Only callable by organization admins or platform admins. Anonymous access revoked.';