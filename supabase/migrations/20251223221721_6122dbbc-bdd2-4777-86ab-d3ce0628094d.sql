-- =============================================
-- FITSCORE DO VENDEDOR - Sistema de Avaliação
-- =============================================

-- 1. Configuração de pesos e fatores do FitScore
CREATE TABLE public.fit_score_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Pesos principais (soma deve ser 1.0)
  cultural_weight NUMERIC(3,2) DEFAULT 0.50 CHECK (cultural_weight >= 0 AND cultural_weight <= 1),
  performance_weight NUMERIC(3,2) DEFAULT 0.50 CHECK (performance_weight >= 0 AND performance_weight <= 1),
  
  -- Fatores culturais com seus pesos
  cultural_factors JSONB DEFAULT '[
    {"key": "valores", "label": "Alinhamento com Valores", "weight": 0.30, "description": "Quanto o vendedor demonstra os valores da empresa"},
    {"key": "comunicacao", "label": "Comunicação", "weight": 0.25, "description": "Clareza e efetividade na comunicação"},
    {"key": "colaboracao", "label": "Colaboração em Equipe", "weight": 0.25, "description": "Trabalho em equipe e cooperação"},
    {"key": "proatividade", "label": "Proatividade", "weight": 0.20, "description": "Iniciativa e antecipação de necessidades"}
  ]'::jsonb,
  
  -- Fatores de desempenho com seus pesos
  performance_factors JSONB DEFAULT '[
    {"key": "metas", "label": "Atingimento de Metas", "weight": 0.40, "description": "Histórico de cumprimento de metas"},
    {"key": "qualidade", "label": "Qualidade do Trabalho", "weight": 0.30, "description": "Qualidade das entregas e atendimento"},
    {"key": "evolucao", "label": "Evolução Contínua", "weight": 0.30, "description": "Crescimento e aprendizado"}
  ]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- 2. Tabela de avaliações do vendedor
CREATE TABLE public.seller_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Período da avaliação
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Scores por categoria (0-100)
  cultural_fit_score NUMERIC(5,2) DEFAULT 0 CHECK (cultural_fit_score >= 0 AND cultural_fit_score <= 100),
  performance_score NUMERIC(5,2) DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
  
  -- Score consolidado final (0-100)
  fit_score NUMERIC(5,2) DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  
  -- Detalhamento dos fatores avaliados
  cultural_factors_scores JSONB DEFAULT '{}'::jsonb,
  performance_factors_scores JSONB DEFAULT '{}'::jsonb,
  
  -- Observações e notas
  notes TEXT,
  strengths TEXT,
  improvements TEXT,
  
  -- Status do workflow
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Uma avaliação por vendedor por período
  UNIQUE(seller_id, period_start, period_end)
);

-- 3. Adicionar campos de FitScore na tabela sellers
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS current_fit_score NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_evaluation_id UUID REFERENCES seller_evaluations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_evaluation_date DATE DEFAULT NULL;

-- 4. Índices para performance
CREATE INDEX idx_seller_evaluations_seller ON seller_evaluations(seller_id);
CREATE INDEX idx_seller_evaluations_org ON seller_evaluations(organization_id);
CREATE INDEX idx_seller_evaluations_status ON seller_evaluations(status);
CREATE INDEX idx_seller_evaluations_period ON seller_evaluations(period_start, period_end);
CREATE INDEX idx_sellers_fit_score ON sellers(current_fit_score) WHERE current_fit_score IS NOT NULL;

-- 5. Trigger para atualizar updated_at
CREATE TRIGGER update_fit_score_config_updated_at
  BEFORE UPDATE ON fit_score_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seller_evaluations_updated_at
  BEFORE UPDATE ON seller_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Função para calcular o FitScore consolidado
CREATE OR REPLACE FUNCTION calculate_evaluation_fit_score()
RETURNS TRIGGER AS $$
DECLARE
  config_record RECORD;
BEGIN
  -- Buscar configuração de pesos da organização
  SELECT cultural_weight, performance_weight 
  INTO config_record
  FROM fit_score_config 
  WHERE organization_id = NEW.organization_id;
  
  -- Se não houver config, usar 50/50
  IF NOT FOUND THEN
    config_record.cultural_weight := 0.50;
    config_record.performance_weight := 0.50;
  END IF;
  
  -- Calcular FitScore ponderado
  NEW.fit_score := ROUND(
    (NEW.cultural_fit_score * config_record.cultural_weight) + 
    (NEW.performance_score * config_record.performance_weight),
    2
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_fit_score
  BEFORE INSERT OR UPDATE OF cultural_fit_score, performance_score ON seller_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_evaluation_fit_score();

-- 7. Função para atualizar o FitScore atual do vendedor quando avaliação é aprovada
CREATE OR REPLACE FUNCTION update_seller_current_fit_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma avaliação é aprovada, atualizar o vendedor
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE sellers
    SET 
      current_fit_score = NEW.fit_score,
      last_evaluation_id = NEW.id,
      last_evaluation_date = NEW.period_end
    WHERE id = NEW.seller_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_seller_fit_score
  AFTER INSERT OR UPDATE OF status ON seller_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_current_fit_score();

-- 8. RLS Policies
ALTER TABLE fit_score_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies para fit_score_config
CREATE POLICY "Users can view their org fit_score_config"
  ON fit_score_config FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage fit_score_config"
  ON fit_score_config FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Policies para seller_evaluations
CREATE POLICY "Users can view their org evaluations"
  ON seller_evaluations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Managers can create evaluations"
  ON seller_evaluations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY "Managers can update evaluations"
  ON seller_evaluations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
  ));

CREATE POLICY "Admins can delete evaluations"
  ON seller_evaluations FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));