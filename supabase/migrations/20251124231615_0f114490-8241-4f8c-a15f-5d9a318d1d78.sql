-- Drop existing problematic policies
DROP POLICY IF EXISTS "opp_shared_view" ON public.opportunities;
DROP POLICY IF EXISTS "Users can view org opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update org opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can insert in own org opps" ON public.opportunities;
DROP POLICY IF EXISTS "Only admins can delete opportunities" ON public.opportunities;

-- Create security definer function to check if user can view an opportunity
CREATE OR REPLACE FUNCTION public.can_view_opportunity(_user_id uuid, _opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user can view all (admin/manager)
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'manager')
  )
  OR EXISTS (
    -- Check if user is the owner
    SELECT 1 FROM opportunities
    WHERE id = _opportunity_id
      AND owner_user_id = _user_id
  )
  OR EXISTS (
    -- Check if user is a deal participant
    SELECT 1 FROM deal_participants dp
    WHERE dp.opportunity_id = _opportunity_id
      AND dp.user_id = _user_id
  );
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view opportunities"
ON public.opportunities
FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND can_view_opportunity(auth.uid(), id)
);

CREATE POLICY "Users can insert opportunities"
ON public.opportunities
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
);

CREATE POLICY "Users can update opportunities"
ON public.opportunities
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (
    owner_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can delete opportunities"
ON public.opportunities
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);