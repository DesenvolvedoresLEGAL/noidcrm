-- Criar enum para tipo de pessoa
CREATE TYPE public.tipo_pessoa_type AS ENUM ('PJ', 'PF');

-- Adicionar novos campos na tabela accounts
ALTER TABLE public.accounts 
ADD COLUMN tipo_pessoa public.tipo_pessoa_type NOT NULL DEFAULT 'PJ',
ADD COLUMN cpf text,
ADD COLUMN parent_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN rg text,
ADD COLUMN data_nascimento date;

-- Criar índice único condicional para CPF (apenas para PF)
CREATE UNIQUE INDEX accounts_cpf_org_unique 
ON public.accounts (organization_id, cpf) 
WHERE tipo_pessoa = 'PF' AND cpf IS NOT NULL;

-- Criar índice único condicional para CNPJ (apenas para PJ)
CREATE UNIQUE INDEX accounts_cnpj_org_unique 
ON public.accounts (organization_id, cnpj) 
WHERE tipo_pessoa = 'PJ' AND cnpj IS NOT NULL;

-- Criar índice para busca de filiais por matriz
CREATE INDEX accounts_parent_account_idx ON public.accounts(parent_account_id);

-- Função para validar CPF (algoritmo módulo 11)
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cpf_clean text;
  sum1 integer := 0;
  sum2 integer := 0;
  d1 integer;
  d2 integer;
  i integer;
BEGIN
  -- Remover caracteres não numéricos
  cpf_clean := regexp_replace(cpf, '[^0-9]', '', 'g');
  
  -- CPF deve ter 11 dígitos
  IF length(cpf_clean) != 11 THEN
    RETURN false;
  END IF;
  
  -- CPFs com todos os dígitos iguais são inválidos
  IF cpf_clean ~ '^(.)\1{10}$' THEN
    RETURN false;
  END IF;
  
  -- Calcular primeiro dígito verificador
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(cpf_clean, i, 1)::integer * (11 - i));
  END LOOP;
  d1 := (sum1 * 10) % 11;
  IF d1 = 10 THEN d1 := 0; END IF;
  
  -- Calcular segundo dígito verificador
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(cpf_clean, i, 1)::integer * (12 - i));
  END LOOP;
  d2 := (sum2 * 10) % 11;
  IF d2 = 10 THEN d2 := 0; END IF;
  
  -- Verificar se os dígitos calculados conferem
  RETURN d1 = substring(cpf_clean, 10, 1)::integer 
     AND d2 = substring(cpf_clean, 11, 1)::integer;
END;
$$;

-- Função para encontrar contas similares considerando tipo_pessoa
CREATE OR REPLACE FUNCTION public.find_similar_accounts(
  p_name text,
  p_org_id uuid DEFAULT NULL,
  p_threshold numeric DEFAULT 0.3,
  p_tipo_pessoa public.tipo_pessoa_type DEFAULT NULL,
  p_parent_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  cpf text,
  tipo_pessoa public.tipo_pessoa_type,
  parent_account_id uuid,
  similarity numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Obter organization_id do usuário atual se não fornecido
  IF p_org_id IS NULL THEN
    SELECT get_user_organization_id() INTO v_org_id;
  ELSE
    v_org_id := p_org_id;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.razao_social,
    a.nome_fantasia,
    a.cnpj,
    a.cpf,
    a.tipo_pessoa,
    a.parent_account_id,
    GREATEST(
      similarity(lower(a.razao_social), lower(p_name)),
      COALESCE(similarity(lower(a.nome_fantasia), lower(p_name)), 0)
    ) as similarity
  FROM accounts a
  WHERE a.organization_id = v_org_id
    AND (p_tipo_pessoa IS NULL OR a.tipo_pessoa = p_tipo_pessoa)
    -- Se tem parent_account_id, permite nome igual (é filial)
    AND (p_parent_account_id IS NULL OR a.id != p_parent_account_id)
    AND GREATEST(
      similarity(lower(a.razao_social), lower(p_name)),
      COALESCE(similarity(lower(a.nome_fantasia), lower(p_name)), 0)
    ) >= p_threshold
  ORDER BY similarity DESC
  LIMIT 10;
END;
$$;

-- Comentários para documentação
COMMENT ON COLUMN public.accounts.tipo_pessoa IS 'Tipo de pessoa: PJ (Pessoa Jurídica) ou PF (Pessoa Física)';
COMMENT ON COLUMN public.accounts.cpf IS 'CPF para pessoas físicas';
COMMENT ON COLUMN public.accounts.parent_account_id IS 'ID da conta matriz (para filiais)';
COMMENT ON COLUMN public.accounts.rg IS 'RG para pessoas físicas';
COMMENT ON COLUMN public.accounts.data_nascimento IS 'Data de nascimento para pessoas físicas';