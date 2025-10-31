-- Fix get_user_organization_id to be deterministic with multiple orgs
-- Using CREATE OR REPLACE to avoid dropping dependent policies
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY joined_at DESC NULLS LAST, created_at DESC
  LIMIT 1
$$;