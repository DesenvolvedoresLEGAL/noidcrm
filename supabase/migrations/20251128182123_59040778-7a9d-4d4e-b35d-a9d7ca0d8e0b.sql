-- Sprint de Correção: Vincular oportunidades órfãs a contas
-- Parte 1: Criar contas para oportunidades que não possuem account_id

-- Criar contas baseadas no título das oportunidades órfãs
INSERT INTO public.accounts (razao_social, organization_id, created_at, updated_at)
SELECT 
  DISTINCT
  REPLACE(REPLACE(o.title, 'Oportunidade - ', ''), 'OPP ', '') as razao_social,
  o.organization_id,
  now() as created_at,
  now() as updated_at
FROM public.opportunities o
WHERE o.account_id IS NULL
  AND o.title IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.razao_social = REPLACE(REPLACE(o.title, 'Oportunidade - ', ''), 'OPP ', '')
    AND a.organization_id = o.organization_id
  );

-- Parte 2: Atualizar oportunidades órfãs com o account_id correspondente
UPDATE public.opportunities o
SET 
  account_id = (
    SELECT a.id 
    FROM public.accounts a 
    WHERE a.razao_social = REPLACE(REPLACE(o.title, 'Oportunidade - ', ''), 'OPP ', '')
    AND a.organization_id = o.organization_id
    LIMIT 1
  ),
  updated_at = now()
WHERE o.account_id IS NULL
  AND o.title IS NOT NULL;