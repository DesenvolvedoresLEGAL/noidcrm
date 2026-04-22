
-- 1. Normalizar segmentos existentes
UPDATE accounts SET segmento = 'Serviços'   WHERE lower(trim(segmento)) IN ('servicos','serviços','serviço','servico');
UPDATE accounts SET segmento = 'Tecnologia' WHERE lower(trim(segmento)) IN ('tecnologia','tech','ti');
UPDATE accounts SET segmento = 'Indústria'  WHERE lower(trim(segmento)) IN ('industria','indústria','industrias','indústrias');
UPDATE accounts SET segmento = 'Outro'      WHERE lower(trim(segmento)) IN ('outro','outros');
UPDATE accounts SET segmento = 'Saúde'      WHERE lower(trim(segmento)) IN ('saude','saúde');
UPDATE accounts SET segmento = 'Comércio'   WHERE lower(trim(segmento)) IN ('comercio','comércio');
UPDATE accounts SET segmento = 'Educação'   WHERE lower(trim(segmento)) IN ('educacao','educação');
UPDATE accounts SET segmento = 'Construção' WHERE lower(trim(segmento)) IN ('construcao','construção');
UPDATE accounts SET segmento = 'Varejo'     WHERE lower(trim(segmento)) IN ('varejo');
UPDATE accounts SET segmento = 'Eventos'    WHERE lower(trim(segmento)) IN ('eventos','evento');
UPDATE accounts SET segmento = 'Marketing'  WHERE lower(trim(segmento)) IN ('marketing','mkt');
UPDATE accounts SET segmento = 'Financeiro' WHERE lower(trim(segmento)) IN ('financeiro','finance','financas','finanças');

-- 2. Trigger para normalizar segmento automaticamente
CREATE OR REPLACE FUNCTION public.normalize_account_segmento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  IF NEW.segmento IS NULL OR trim(NEW.segmento) = '' THEN
    NEW.segmento := NULL;
    RETURN NEW;
  END IF;

  s := lower(trim(NEW.segmento));

  -- Mapa de aliases
  NEW.segmento := CASE
    WHEN s IN ('servicos','serviços','serviço','servico') THEN 'Serviços'
    WHEN s IN ('tecnologia','tech','ti') THEN 'Tecnologia'
    WHEN s IN ('industria','indústria','industrias','indústrias') THEN 'Indústria'
    WHEN s IN ('outro','outros') THEN 'Outro'
    WHEN s IN ('saude','saúde') THEN 'Saúde'
    WHEN s IN ('comercio','comércio') THEN 'Comércio'
    WHEN s IN ('educacao','educação') THEN 'Educação'
    WHEN s IN ('construcao','construção') THEN 'Construção'
    WHEN s IN ('varejo') THEN 'Varejo'
    WHEN s IN ('eventos','evento') THEN 'Eventos'
    WHEN s IN ('marketing','mkt') THEN 'Marketing'
    WHEN s IN ('financeiro','finance','financas','finanças') THEN 'Financeiro'
    ELSE initcap(trim(NEW.segmento))
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_account_segmento ON public.accounts;
CREATE TRIGGER trg_normalize_account_segmento
BEFORE INSERT OR UPDATE OF segmento ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_account_segmento();

-- 3. Tabela de jobs para tracking de recálculo em massa
CREATE TABLE IF NOT EXISTS public.score_recalc_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'account',
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | completed | failed
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_recalc_jobs_org_status
  ON public.score_recalc_jobs (organization_id, status, created_at DESC);

ALTER TABLE public.score_recalc_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "score_recalc_jobs_select_own_org" ON public.score_recalc_jobs;
CREATE POLICY "score_recalc_jobs_select_own_org"
  ON public.score_recalc_jobs
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "score_recalc_jobs_insert_own_org" ON public.score_recalc_jobs;
CREATE POLICY "score_recalc_jobs_insert_own_org"
  ON public.score_recalc_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_score_recalc_jobs_updated_at
BEFORE UPDATE ON public.score_recalc_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
