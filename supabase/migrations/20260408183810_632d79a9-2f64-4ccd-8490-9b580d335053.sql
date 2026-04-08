
DROP POLICY IF EXISTS "Service role full access on cnpj_cache" ON public.cnpj_cache;

CREATE POLICY "Service role full access on cnpj_cache"
ON public.cnpj_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
