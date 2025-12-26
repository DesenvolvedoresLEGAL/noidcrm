
-- ===========================================
-- NOID Performance Engine V2 - Fase 2: Motor de Scores
-- ===========================================

-- 1. Tabela de Scores de Performance do Vendedor
CREATE TABLE public.seller_performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  
  -- Capability Score (baseado em treinamento e evolução)
  cs_7d NUMERIC(5,2) DEFAULT 0,
  cs_30d NUMERIC(5,2) DEFAULT 0,
  cs_90d NUMERIC(5,2) DEFAULT 0,
  cs_final NUMERIC(5,2) DEFAULT 0,
  cs_breakdown JSONB DEFAULT '{}',
  
  -- Behavior Score (baseado em atividades e disciplina)
  bs_7d NUMERIC(5,2) DEFAULT 0,
  bs_30d NUMERIC(5,2) DEFAULT 0,
  bs_90d NUMERIC(5,2) DEFAULT 0,
  bs_final NUMERIC(5,2) DEFAULT 0,
  bs_breakdown JSONB DEFAULT '{}',
  
  -- Delivery Score (baseado em resultados)
  ds_7d NUMERIC(5,2) DEFAULT 0,
  ds_30d NUMERIC(5,2) DEFAULT 0,
  ds_90d NUMERIC(5,2) DEFAULT 0,
  ds_final NUMERIC(5,2) DEFAULT 0,
  ds_breakdown JSONB DEFAULT '{}',
  
  -- Role Alignment Score (fit com cargo)
  ras_final NUMERIC(5,2) DEFAULT 0,
  ras_status TEXT DEFAULT 'aligned' CHECK (ras_status IN ('under_allocated', 'aligned', 'misaligned', 'out_of_position')),
  ras_breakdown JSONB DEFAULT '{}',
  
  -- Metadata
  algorithm_version TEXT DEFAULT 'v2.0',
  calculation_inputs JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  UNIQUE(seller_id)
);

ALTER TABLE public.seller_performance_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sps_select" ON public.seller_performance_scores FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "sps_insert" ON public.seller_performance_scores FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "sps_update" ON public.seller_performance_scores FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "sps_delete" ON public.seller_performance_scores FOR DELETE
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE INDEX idx_sps_seller ON public.seller_performance_scores(seller_id);
CREATE INDEX idx_sps_org ON public.seller_performance_scores(organization_id);
CREATE INDEX idx_sps_calculated ON public.seller_performance_scores(calculated_at DESC);

-- 2. Tabela de Histórico de Scores
CREATE TABLE public.seller_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL CHECK (score_type IN ('CS', 'BS', 'DS', 'RAS')),
  period_type TEXT NOT NULL CHECK (period_type IN ('7d', '30d', '90d', 'final')),
  old_value NUMERIC(5,2),
  new_value NUMERIC(5,2),
  change_reason TEXT,
  breakdown JSONB DEFAULT '{}',
  algorithm_version TEXT DEFAULT 'v2.0',
  created_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
);

ALTER TABLE public.seller_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssh_select" ON public.seller_score_history FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "ssh_insert" ON public.seller_score_history FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE INDEX idx_ssh_seller ON public.seller_score_history(seller_id);
CREATE INDEX idx_ssh_org ON public.seller_score_history(organization_id);
CREATE INDEX idx_ssh_type ON public.seller_score_history(score_type, period_type);
CREATE INDEX idx_ssh_created ON public.seller_score_history(created_at DESC);

-- 3. Tabela de configuração de mínimos por cargo OTE (para RAS)
CREATE TABLE public.ote_score_minimums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ote_level_id UUID NOT NULL REFERENCES public.ote_levels(id) ON DELETE CASCADE,
  min_cs NUMERIC(5,2) DEFAULT 60,
  min_bs NUMERIC(5,2) DEFAULT 60,
  min_ds NUMERIC(5,2) DEFAULT 50,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ote_level_id)
);

ALTER TABLE public.ote_score_minimums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "osm_select" ON public.ote_score_minimums FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "osm_all" ON public.ote_score_minimums FOR ALL
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'owner')));

CREATE INDEX idx_osm_ote ON public.ote_score_minimums(ote_level_id);

-- Trigger updated_at
CREATE TRIGGER upd_ote_score_minimums_at BEFORE UPDATE ON public.ote_score_minimums
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
