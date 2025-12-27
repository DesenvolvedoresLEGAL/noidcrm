-- Drop existing policies
DROP POLICY IF EXISTS "Users can view opportunity public forms in their organization" ON public.opportunity_public_forms;
DROP POLICY IF EXISTS "Users can create opportunity public forms in their organization" ON public.opportunity_public_forms;
DROP POLICY IF EXISTS "Users can update opportunity public forms in their organization" ON public.opportunity_public_forms;
DROP POLICY IF EXISTS "Users can delete opportunity public forms in their organization" ON public.opportunity_public_forms;

-- Create a security definer function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR UPDATE
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR DELETE
USING (organization_id = public.get_user_organization_id());