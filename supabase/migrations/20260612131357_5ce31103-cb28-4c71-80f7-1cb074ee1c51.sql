DROP POLICY IF EXISTS "Users can create own seller profile" ON public.sellers;
CREATE POLICY "Users can create own seller profile"
ON public.sellers
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = sellers.organization_id
      AND om.status = 'active'
  )
);