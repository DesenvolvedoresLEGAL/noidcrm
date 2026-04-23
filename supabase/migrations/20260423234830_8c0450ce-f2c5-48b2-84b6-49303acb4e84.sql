
CREATE INDEX IF NOT EXISTS idx_accounts_backfill_segmento_pending
ON public.accounts(id)
WHERE deleted_at IS NULL AND cnpj IS NOT NULL AND cnae IS NULL;

CREATE OR REPLACE FUNCTION public.fn_list_accounts_for_segmento_backfill(p_limit INT DEFAULT 25)
RETURNS TABLE (id UUID, cnpj TEXT, razao_social TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  SELECT a.id, a.cnpj, a.razao_social
  FROM public.accounts a
  WHERE a.deleted_at IS NULL
    AND a.cnpj IS NOT NULL
    AND a.cnae IS NULL
  ORDER BY a.created_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
