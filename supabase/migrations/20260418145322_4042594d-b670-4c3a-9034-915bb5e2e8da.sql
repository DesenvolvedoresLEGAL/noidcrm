CREATE POLICY "Service role manages digest runs"
ON public.daily_digest_runs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role manages digest cache"
ON public.daily_digest_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);