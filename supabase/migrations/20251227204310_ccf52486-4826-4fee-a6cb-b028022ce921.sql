-- Fix the get_user_organization_id function to use user_id instead of id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.profiles 
  WHERE user_id = auth.uid() OR id = auth.uid()
  LIMIT 1
$$;