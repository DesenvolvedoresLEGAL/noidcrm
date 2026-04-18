
-- Remove a MV do schema exposto pela API (ela é consumida só via RPC)
REVOKE ALL ON public.mv_notification_admin_metrics FROM anon, authenticated;

-- Substitui a policy "deny all" (que aciona warning) por simples revogação total
DROP POLICY IF EXISTS "deny all dedup keys" ON public.notification_dedup_keys;
REVOKE ALL ON public.notification_dedup_keys FROM anon, authenticated;
