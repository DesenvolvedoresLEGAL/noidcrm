-- FASE 1: Sistema de Propostas Avançado - Estrutura de Banco de Dados

-- 1. Atualizar tabela proposals com novos campos
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_reason TEXT,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS introduction TEXT,
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

-- 2. Criar tabela de itens da proposta (produtos/serviços)
CREATE TABLE IF NOT EXISTS proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Dados do item
  order_index INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_cost NUMERIC DEFAULT 0,
  markup_percent NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  ipi_percent NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  
  -- Metadados
  image_url TEXT,
  characteristics JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Criar tabela de formas de pagamento
CREATE TABLE IF NOT EXISTS proposal_payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Tipo: 'one_time' (P&S) ou 'recurring' (MRR)
  payment_type TEXT NOT NULL DEFAULT 'one_time',
  
  -- Dados P&S (one_time)
  entry_date DATE,
  entry_percent NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  installments INTEGER DEFAULT 1,
  first_installment_date DATE,
  installment_interval_days INTEGER DEFAULT 30,
  due_day INTEGER DEFAULT 10,
  
  -- Dados MRR (recurring)
  first_payment_date DATE,
  monthly_value NUMERIC DEFAULT 0,
  contract_total NUMERIC DEFAULT 0,
  
  -- Comentários (rich text)
  comments TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Criar tabela de templates de proposta
CREATE TABLE IF NOT EXISTS proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Conteúdo do template
  introduction TEXT,
  terms TEXT,
  notes TEXT,
  
  -- Items padrão (JSON array)
  default_items JSONB DEFAULT '[]'::jsonb,
  
  -- Configurações
  is_default BOOLEAN DEFAULT false,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Criar tabela de histórico de visualizações
CREATE TABLE IF NOT EXISTS proposal_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  duration_seconds INTEGER
);

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_id ON proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_items_organization_id ON proposal_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposal_items_product_id ON proposal_items(product_id);

CREATE INDEX IF NOT EXISTS idx_proposal_payment_terms_proposal_id ON proposal_payment_terms(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_payment_terms_organization_id ON proposal_payment_terms(organization_id);

CREATE INDEX IF NOT EXISTS idx_proposal_templates_organization_id ON proposal_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_proposals_public_token ON proposals(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_parent_proposal_id ON proposals(parent_proposal_id) WHERE parent_proposal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_views_proposal_id ON proposal_views(proposal_id);

-- 7. Criar triggers para updated_at
CREATE TRIGGER update_proposal_items_updated_at 
  BEFORE UPDATE ON proposal_items
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposal_payment_terms_updated_at 
  BEFORE UPDATE ON proposal_payment_terms
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposal_templates_updated_at 
  BEFORE UPDATE ON proposal_templates
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Habilitar RLS em todas as novas tabelas
ALTER TABLE proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_views ENABLE ROW LEVEL SECURITY;

-- 9. Criar RLS Policies para proposal_items
CREATE POLICY "Users can view proposal items in their org" 
  ON proposal_items FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can create proposal items in their org" 
  ON proposal_items FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can update proposal items in their org" 
  ON proposal_items FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can delete proposal items in their org" 
  ON proposal_items FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- 10. Criar RLS Policies para proposal_payment_terms
CREATE POLICY "Users can view payment terms in their org" 
  ON proposal_payment_terms FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can create payment terms in their org" 
  ON proposal_payment_terms FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can update payment terms in their org" 
  ON proposal_payment_terms FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can delete payment terms in their org" 
  ON proposal_payment_terms FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- 11. Criar RLS Policies para proposal_templates
CREATE POLICY "Users can view templates in their org" 
  ON proposal_templates FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can create templates in their org" 
  ON proposal_templates FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can update templates in their org" 
  ON proposal_templates FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can delete templates in their org" 
  ON proposal_templates FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- 12. Criar RLS Policies para proposal_views (somente leitura)
CREATE POLICY "Users can view proposal views in their org" 
  ON proposal_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = proposal_views.proposal_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "System can insert proposal views" 
  ON proposal_views FOR INSERT
  WITH CHECK (true);

-- 13. Criar função para gerar token público único
CREATE OR REPLACE FUNCTION generate_proposal_public_token()
RETURNS TEXT AS $$
DECLARE
  new_token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Gerar token aleatório de 32 caracteres
    new_token := encode(gen_random_bytes(24), 'base64');
    new_token := replace(replace(replace(new_token, '/', '_'), '+', '-'), '=', '');
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM proposals WHERE public_token = new_token) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;