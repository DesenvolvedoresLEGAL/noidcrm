-- Migration: Corrigir dados antigos de accounts (tratando duplicados)

-- 1. Converter MEIs para PF (padrão XX.XXX.XXX NOME COMPLETO)
UPDATE public.accounts
SET 
  tipo_pessoa = 'PF',
  cpf = SUBSTRING(razao_social FROM '^(\d{2}\.\d{3}\.\d{3})'),
  razao_social = TRIM(SUBSTRING(razao_social FROM '^\d{2}\.\d{3}\.\d{3}\s+(.+)$'))
WHERE razao_social ~ '^\d{2}\.\d{3}\.\d{3}\s+[A-Z]'
  AND tipo_pessoa = 'PJ'
  AND cpf IS NULL;

-- 2. Converter cadastros onde razao_social é apenas um CPF formatado
UPDATE public.accounts
SET 
  tipo_pessoa = 'PF',
  cpf = razao_social
WHERE razao_social ~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$'
  AND tipo_pessoa = 'PJ'
  AND cpf IS NULL;

-- 3. Mover CNPJs que estão incorretamente na razao_social para o campo cnpj
-- APENAS se o CNPJ não existir em outro registro
UPDATE public.accounts a
SET 
  cnpj = a.razao_social,
  razao_social = COALESCE(a.nome_fantasia, 'Empresa sem nome')
WHERE a.razao_social ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'
  AND a.cnpj IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts b 
    WHERE b.cnpj = a.razao_social AND b.id != a.id
  );

-- 4. Marcar registros duplicados para revisão manual (adicionar observação)
UPDATE public.accounts a
SET 
  observacoes = COALESCE(observacoes || E'\n', '') || '[REVISÃO NECESSÁRIA] CNPJ duplicado: ' || a.razao_social || ' - Verificar e corrigir manualmente.'
WHERE a.razao_social ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'
  AND a.cnpj IS NULL
  AND EXISTS (
    SELECT 1 FROM public.accounts b 
    WHERE b.cnpj = a.razao_social AND b.id != a.id
  );

-- 5. Criar função para conversão rápida PJ <-> PF
CREATE OR REPLACE FUNCTION public.convert_account_type(
  p_account_id UUID,
  p_new_type public.tipo_pessoa_type
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_user_org_id UUID;
BEGIN
  SELECT get_user_organization_id() INTO v_user_org_id;
  
  SELECT organization_id INTO v_org_id
  FROM accounts
  WHERE id = p_account_id;
  
  IF v_org_id IS NULL OR v_org_id != v_user_org_id THEN
    RETURN FALSE;
  END IF;
  
  UPDATE accounts
  SET 
    tipo_pessoa = p_new_type,
    cnpj = CASE WHEN p_new_type = 'PF' THEN NULL ELSE cnpj END,
    cpf = CASE WHEN p_new_type = 'PJ' THEN NULL ELSE cpf END,
    rg = CASE WHEN p_new_type = 'PJ' THEN NULL ELSE rg END,
    data_nascimento = CASE WHEN p_new_type = 'PJ' THEN NULL ELSE data_nascimento END,
    inscricao_estadual = CASE WHEN p_new_type = 'PF' THEN NULL ELSE inscricao_estadual END,
    inscricao_municipal = CASE WHEN p_new_type = 'PF' THEN NULL ELSE inscricao_municipal END,
    natureza_juridica = CASE WHEN p_new_type = 'PF' THEN NULL ELSE natureza_juridica END,
    capital_social = CASE WHEN p_new_type = 'PF' THEN NULL ELSE capital_social END,
    porte = CASE WHEN p_new_type = 'PF' THEN NULL ELSE porte END,
    matriz_filial = CASE WHEN p_new_type = 'PF' THEN NULL ELSE matriz_filial END,
    opcao_simples = CASE WHEN p_new_type = 'PF' THEN NULL ELSE opcao_simples END,
    opcao_mei = CASE WHEN p_new_type = 'PF' THEN NULL ELSE opcao_mei END,
    updated_at = NOW()
  WHERE id = p_account_id;
  
  RETURN TRUE;
END;
$$;