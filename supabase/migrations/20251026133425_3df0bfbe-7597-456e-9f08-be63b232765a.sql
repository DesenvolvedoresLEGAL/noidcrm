-- Allow authenticated users to insert pipelines for their organization
CREATE POLICY "Users can insert org pipelines"
  ON public.pipelines
  FOR INSERT
  WITH CHECK ((organization_id = get_user_organization_id()) OR (organization_id IS NULL));

-- Allow organization admins to update pipelines
CREATE POLICY "Org admins can update pipelines"
  ON public.pipelines
  FOR UPDATE
  USING (user_is_org_admin(organization_id));

-- Allow organization admins to delete pipelines
CREATE POLICY "Org admins can delete pipelines"
  ON public.pipelines
  FOR DELETE
  USING (user_is_org_admin(organization_id));

-- Allow authenticated users to insert stages for their organization
CREATE POLICY "Users can insert org stages"
  ON public.stages
  FOR INSERT
  WITH CHECK ((organization_id = get_user_organization_id()) OR (organization_id IS NULL));

-- Allow organization admins to update stages
CREATE POLICY "Org admins can update stages"
  ON public.stages
  FOR UPDATE
  USING (user_is_org_admin(organization_id));

-- Allow organization admins to delete stages
CREATE POLICY "Org admins can delete stages"
  ON public.stages
  FOR DELETE
  USING (user_is_org_admin(organization_id));