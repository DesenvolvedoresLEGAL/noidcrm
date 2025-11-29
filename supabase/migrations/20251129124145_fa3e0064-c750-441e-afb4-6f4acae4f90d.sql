-- ============================================
-- FASE 1: EXPANSÃO DO BANCO DE DADOS - ACCOUNTS
-- ============================================

-- Adicionar novas colunas na tabela accounts
ALTER TABLE public.accounts
  -- Informações da Empresa
  ADD COLUMN inscricao_estadual TEXT,
  ADD COLUMN inscricao_municipal TEXT,
  ADD COLUMN natureza_juridica TEXT,
  ADD COLUMN porte TEXT,
  ADD COLUMN situacao_cadastral TEXT,
  ADD COLUMN data_situacao_cadastral DATE,
  ADD COLUMN data_fundacao DATE,
  ADD COLUMN capital_social NUMERIC(15,2),
  ADD COLUMN matriz_filial TEXT,
  ADD COLUMN cnaes_secundarios TEXT[],
  ADD COLUMN opcao_simples BOOLEAN DEFAULT false,
  ADD COLUMN opcao_mei BOOLEAN DEFAULT false,
  
  -- Endereço Completo
  ADD COLUMN logradouro TEXT,
  ADD COLUMN numero TEXT,
  ADD COLUMN complemento TEXT,
  ADD COLUMN bairro TEXT,
  ADD COLUMN cidade TEXT,
  ADD COLUMN uf TEXT,
  ADD COLUMN cep TEXT,
  ADD COLUMN latitude NUMERIC(10,8),
  ADD COLUMN longitude NUMERIC(11,8),
  
  -- Contatos
  ADD COLUMN telefones JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN emails TEXT[],
  ADD COLUMN website TEXT,
  ADD COLUMN linkedin TEXT,
  ADD COLUMN instagram TEXT,
  ADD COLUMN facebook TEXT,
  
  -- Responsáveis
  ADD COLUMN owner_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN cs_user_id UUID REFERENCES auth.users(id),
  
  -- Dados Comerciais
  ADD COLUMN tipo_empresa TEXT,
  ADD COLUMN data_tornou_cliente DATE,
  ADD COLUMN pontuacao_nps INTEGER,
  ADD COLUMN email_nota_fiscal TEXT,
  ADD COLUMN codigo_externo TEXT,
  ADD COLUMN logo_url TEXT,
  
  -- Anotações
  ADD COLUMN observacoes TEXT;

-- Renomear faturamento para faturamento_anual (se ainda não existir a nova)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'faturamento'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'faturamento_anual'
  ) THEN
    ALTER TABLE public.accounts RENAME COLUMN faturamento TO faturamento_anual;
  END IF;
END $$;

-- ============================================
-- CRIAR TABELA account_partners (Sócios/QSA)
-- ============================================

CREATE TABLE IF NOT EXISTS public.account_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome_socio TEXT NOT NULL,
  cpf_cnpj_socio TEXT,
  qualificacao TEXT,
  data_entrada DATE,
  faixa_etaria TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.account_partners ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para account_partners
CREATE POLICY "Users can view org account partners"
  ON public.account_partners
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org account partners"
  ON public.account_partners
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org account partners"
  ON public.account_partners
  FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete org account partners"
  ON public.account_partners
  FOR DELETE
  USING (
    user_is_org_admin(organization_id) OR 
    (organization_id = get_user_organization_id() AND organization_id IS NOT NULL)
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_account_partners_updated_at
  BEFORE UPDATE ON public.account_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_account_partners_account_id ON public.account_partners(account_id);
CREATE INDEX IF NOT EXISTS idx_account_partners_organization_id ON public.account_partners(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id ON public.accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_cs_user_id ON public.accounts(cs_user_id);