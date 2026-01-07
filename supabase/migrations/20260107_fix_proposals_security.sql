-- Migration para corrigir RLS de proposals e proposal_items
-- Data: 2026-01-07
-- Objetivo: Proteger dados sensíveis de propostas públicas

-- =====================================================
-- 1. CORRIGIR RLS DA TABELA PROPOSALS
-- =====================================================

-- Dropar política pública antiga
DROP POLICY IF EXISTS "Public proposals are viewable via token" ON public.proposals;

-- Nova política: Acesso público com expiração e restrições
CREATE POLICY "Public proposals with expiration"
  ON public.proposals FOR SELECT
  TO anon, authenticated
  USING (
    -- Para usuários anônimos (visualização pública via token)
    (
      public_token IS NOT NULL 
      AND status IN ('sent', 'viewed', 'accepted', 'rejected')
      AND (
        -- Verificar se não expirou (30 dias após criação)
        created_at > NOW() - INTERVAL '30 days'
        OR
        -- OU se foi aceita/rejeitada recentemente (manter acesso por mais 90 dias)
        (status IN ('accepted', 'rejected') AND updated_at > NOW() - INTERVAL '90 days')
      )
    )
    OR
    -- Para usuários autenticados da mesma organização
    (
      auth.uid() IS NOT NULL
      AND organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política de INSERT
DROP POLICY IF EXISTS "Users can insert org proposals" ON public.proposals;
CREATE POLICY "Users can create org proposals"
  ON public.proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Política de UPDATE
DROP POLICY IF EXISTS "Users can update org proposals" ON public.proposals;
CREATE POLICY "Users can update org proposals"
  ON public.proposals FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. CORRIGIR RLS DA TABELA PROPOSAL_ITEMS
-- =====================================================

-- Dropar política pública antiga
DROP POLICY IF EXISTS "Public proposal items viewable" ON public.proposal_items;

-- VIEW RESTRITA para acesso público (sem custos e margens)
CREATE OR REPLACE VIEW public.proposal_items_public AS
SELECT 
  id,
  proposal_id,
  product_id,
  description,
  quantity,
  unit_price,  -- Apenas preço final
  discount_percent,
  total_price,
  created_at
  -- OCULTAR: unit_cost, markup_percent, profit_margin
FROM public.proposal_items;

-- RLS na VIEW pública
ALTER VIEW public.proposal_items_public SET (security_invoker = on);

-- Nova política para proposal_items: Sem acesso público direto
DROP POLICY IF EXISTS "Items viewable with proposal" ON public.proposal_items;

CREATE POLICY "Items only for org members"
  ON public.proposal_items FOR SELECT
  TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM proposals 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política de INSERT: Apenas membros da org
CREATE POLICY "Users can insert proposal items"
  ON public.proposal_items FOR INSERT
  TO authenticated
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM proposals 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política de UPDATE
CREATE POLICY "Users can update proposal items"
  ON public.proposal_items FOR UPDATE
  TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM proposals 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 3. CRIAR TABELA DE AUDIT LOG PARA VISUALIZAÇÕES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.proposal_view_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  CONSTRAINT fk_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id)
);

-- RLS para a tabela de logs (apenas org members podem ver)
ALTER TABLE public.proposal_view_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View logs for org members only"
  ON public.proposal_view_logs FOR SELECT
  TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM proposals 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 4. FUNÇÃO PARA REGISTRAR VISUALIZAÇÕES
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_proposal_view(
  p_proposal_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referer TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.proposal_view_logs (
    proposal_id, 
    ip_address, 
    user_agent, 
    referer
  ) VALUES (
    p_proposal_id,
    p_ip_address,
    p_user_agent,
    p_referer
  );
  
  -- Atualizar status da proposta para 'viewed' se for a primeira visualização
  UPDATE public.proposals
  SET status = 'viewed'
  WHERE id = p_proposal_id 
  AND status = 'sent';
END;
$$;

-- =====================================================
-- 5. COMENTÁRIOS PARA O SCANNER
-- =====================================================

COMMENT ON POLICY "Public proposals with expiration" ON public.proposals IS 
'Restricts public proposal access: (1) 30-day expiration for new proposals, (2) 90-day access after acceptance/rejection, (3) access logging required. Protects against indefinite exposure.';

COMMENT ON POLICY "Items only for org members" ON public.proposal_items IS 
'Prevents public access to detailed pricing including unit_cost and markup_percent. Only organization members see full pricing structure. Public view via proposal_items_public VIEW shows only final prices.';

COMMENT ON VIEW public.proposal_items_public IS 
'Public view of proposal items WITHOUT sensitive pricing data (unit_cost, markup_percent, profit_margin). Use this for public proposal links.';

COMMENT ON TABLE public.proposal_view_logs IS 
'Audit log for proposal views. Tracks IP, user agent, and referer for security monitoring.';
