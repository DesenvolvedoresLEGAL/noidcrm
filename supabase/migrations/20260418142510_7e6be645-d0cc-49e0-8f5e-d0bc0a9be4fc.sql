
-- Policy explícita restritiva (resolve INFO "RLS enabled no policy")
CREATE POLICY "system only - no client access" ON public.notification_dedup_keys
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
