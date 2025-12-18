-- Fase 1: Remover constraint CNPJ global conflitante
-- A constraint accounts_cnpj_key bloqueia cadastros de CNPJs entre organizações diferentes
-- Mantemos apenas accounts_cnpj_org_unique que é correto (único por organização)

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_cnpj_key;

-- Verificar e garantir que o índice correto por organização existe
CREATE UNIQUE INDEX IF NOT EXISTS accounts_cnpj_org_unique 
ON public.accounts (organization_id, cnpj) 
WHERE tipo_pessoa = 'PJ' AND cnpj IS NOT NULL;