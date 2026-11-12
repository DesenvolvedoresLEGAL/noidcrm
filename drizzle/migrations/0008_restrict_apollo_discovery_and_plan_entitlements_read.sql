DROP POLICY IF EXISTS "apollo_endpoint_discovery_read_all" ON public.apollo_endpoint_discovery;
CREATE POLICY "apollo_endpoint_discovery_read_admins" ON public.apollo_endpoint_discovery
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Entitlements are publicly readable" ON public.plan_entitlements;
CREATE POLICY "Entitlements readable by signed-in users" ON public.plan_entitlements
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);