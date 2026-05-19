DROP POLICY IF EXISTS "Admins delete activities" ON public.activities;

CREATE POLICY "Org members delete activities"
ON public.activities
FOR DELETE
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);