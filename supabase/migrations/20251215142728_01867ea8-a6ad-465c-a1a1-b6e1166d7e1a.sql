-- Drop existing update policy and create one that allows org admins
DROP POLICY IF EXISTS "Users update only own profile" ON public.profiles;

-- Create policy that allows users to update their own profile OR org admins can update any profile in their org
CREATE POLICY "Users or org admins can update profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR user_is_org_admin_or_manager(organization_id)
)
WITH CHECK (
  user_id = auth.uid() 
  OR user_is_org_admin_or_manager(organization_id)
);