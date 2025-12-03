-- =====================================================
-- LEAD & OPPORTUNITY SCORING SYSTEM - WORLD CLASS
-- =====================================================

-- 1. Add scoring columns to accounts (Lead/Account Scoring)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fit_score INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS intent_score INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS lead_grade TEXT DEFAULT 'D';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS scoring_factors JSONB DEFAULT '{}';

-- 2. Add scoring columns to opportunities (Opportunity Scoring)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS velocity_score INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_score INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS win_probability_ai NUMERIC(5,2);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS score_confidence TEXT DEFAULT 'low';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS scoring_factors JSONB DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

-- 3. Create score_history table for tracking changes
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'opportunity')),
  entity_id UUID NOT NULL,
  score_type TEXT NOT NULL CHECK (score_type IN ('fit', 'intent', 'engagement', 'velocity', 'risk', 'composite', 'lead', 'opportunity', 'win_probability')),
  old_value INTEGER,
  new_value INTEGER NOT NULL,
  change_reason TEXT,
  factors JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create scoring_rules table for customizable rules
CREATE TABLE IF NOT EXISTS scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  score_type TEXT NOT NULL CHECK (score_type IN ('fit', 'intent', 'engagement', 'velocity', 'risk')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'opportunity')),
  condition_field TEXT NOT NULL,
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty')),
  condition_value TEXT,
  points INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create score_alerts table for notifications
CREATE TABLE IF NOT EXISTS score_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'opportunity')),
  entity_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('grade_up', 'grade_down', 'high_risk', 'hot_lead', 'score_drop', 'score_surge')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- 6. Enable RLS
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_alerts ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for score_history
CREATE POLICY "Users can view org score history"
ON score_history FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert score history"
ON score_history FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- 8. RLS Policies for scoring_rules
CREATE POLICY "Users can view org scoring rules"
ON scoring_rules FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage scoring rules"
ON scoring_rules FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- 9. RLS Policies for score_alerts
CREATE POLICY "Users can view own score alerts"
ON score_alerts FOR SELECT
USING (user_id = auth.uid() OR user_is_org_admin(organization_id));

CREATE POLICY "Users can update own score alerts"
ON score_alerts FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "System can insert score alerts"
ON score_alerts FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_score_history_entity ON score_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_score_history_org_created ON score_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_org_active ON scoring_rules(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_score_alerts_user_unread ON score_alerts(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_lead_score ON accounts(organization_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_lead_grade ON accounts(organization_id, lead_grade);
CREATE INDEX IF NOT EXISTS idx_opportunities_opp_score ON opportunities(organization_id, opportunity_score DESC);

-- 11. Function to calculate lead grade from score
CREATE OR REPLACE FUNCTION calculate_lead_grade(score INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN score >= 80 THEN 'A'
    WHEN score >= 60 THEN 'B'
    WHEN score >= 40 THEN 'C'
    WHEN score >= 20 THEN 'D'
    ELSE 'F'
  END;
END;
$$;

-- 12. Function to update account scores
CREATE OR REPLACE FUNCTION update_account_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Calculate composite lead_score
  NEW.lead_score := ROUND((NEW.fit_score * 0.4) + (NEW.intent_score * 0.6));
  
  -- Calculate lead grade
  NEW.lead_grade := calculate_lead_grade(NEW.lead_score);
  
  -- Update timestamp
  NEW.score_updated_at := now();
  
  RETURN NEW;
END;
$$;

-- 13. Trigger for account score updates
DROP TRIGGER IF EXISTS trigger_update_account_scores ON accounts;
CREATE TRIGGER trigger_update_account_scores
BEFORE UPDATE OF fit_score, intent_score ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_account_scores();

-- 14. Function to update opportunity scores
CREATE OR REPLACE FUNCTION update_opportunity_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Calculate composite opportunity_score
  -- engagement (30%) + velocity (25%) + (100-risk) (25%) + win_probability (20%)
  NEW.opportunity_score := ROUND(
    (COALESCE(NEW.engagement_score, 0) * 0.30) +
    (COALESCE(NEW.velocity_score, 0) * 0.25) +
    ((100 - COALESCE(NEW.risk_score, 0)) * 0.25) +
    (COALESCE(NEW.win_probability_ai, 50) * 0.20)
  );
  
  -- Update timestamp
  NEW.score_updated_at := now();
  
  RETURN NEW;
END;
$$;

-- 15. Trigger for opportunity score updates
DROP TRIGGER IF EXISTS trigger_update_opportunity_scores ON opportunities;
CREATE TRIGGER trigger_update_opportunity_scores
BEFORE UPDATE OF engagement_score, velocity_score, risk_score, win_probability_ai ON opportunities
FOR EACH ROW
EXECUTE FUNCTION update_opportunity_scores();

-- 16. Seed default scoring rules
INSERT INTO scoring_rules (organization_id, name, description, score_type, entity_type, condition_field, condition_operator, condition_value, points)
SELECT 
  o.id,
  rule.name,
  rule.description,
  rule.score_type,
  rule.entity_type,
  rule.condition_field,
  rule.condition_operator,
  rule.condition_value,
  rule.points
FROM organizations o
CROSS JOIN (VALUES
  -- FIT Score Rules
  ('Segmento Premium', 'Empresas de segmentos premium', 'fit', 'account', 'segmento', 'contains', 'Eventos', 25),
  ('Empresa Grande', 'Empresas de grande porte', 'fit', 'account', 'tamanho', 'equals', 'Grande', 20),
  ('Empresa Média', 'Empresas de médio porte', 'fit', 'account', 'tamanho', 'equals', 'Média', 15),
  ('Capital Alto', 'Capital social acima de 1M', 'fit', 'account', 'capital_social', 'greater_than', '1000000', 15),
  ('Dados Completos', 'CNPJ e telefone preenchidos', 'fit', 'account', 'cnpj', 'is_not_empty', '', 10),
  
  -- INTENT Score Rules
  ('Email Respondido', 'Cliente respondeu email', 'intent', 'account', 'email_replied', 'equals', 'true', 15),
  ('Reunião Realizada', 'Reunião foi concluída', 'intent', 'account', 'meeting_completed', 'equals', 'true', 25),
  ('Proposta Visualizada', 'Proposta foi visualizada', 'intent', 'account', 'proposal_viewed', 'equals', 'true', 20),
  
  -- ENGAGEMENT Score Rules
  ('Múltiplas Atividades', 'Mais de 5 atividades', 'engagement', 'opportunity', 'activities_count', 'greater_than', '5', 20),
  ('Proposta Enviada', 'Proposta foi enviada', 'engagement', 'opportunity', 'proposal_sent', 'equals', 'true', 15),
  ('Arquivos Anexados', 'Tem arquivos anexados', 'engagement', 'opportunity', 'files_count', 'greater_than', '0', 10),
  
  -- VELOCITY Score Rules
  ('Progressão Rápida', 'Avançou de stage', 'velocity', 'opportunity', 'stage_changed', 'equals', 'true', 15),
  ('Close Date Próxima', 'Fechamento em menos de 7 dias', 'velocity', 'opportunity', 'days_to_close', 'less_than', '7', 10),
  
  -- RISK Score Rules
  ('Sem Contato', 'Mais de 14 dias sem contato', 'risk', 'opportunity', 'days_since_contact', 'greater_than', '14', 20),
  ('Proposta Rejeitada', 'Proposta foi rejeitada', 'risk', 'opportunity', 'proposal_rejected', 'equals', 'true', 30),
  ('Concorrente Mencionado', 'Concorrente foi mencionado', 'risk', 'opportunity', 'competitor_mentioned', 'equals', 'true', 15)
) AS rule(name, description, score_type, entity_type, condition_field, condition_operator, condition_value, points)
ON CONFLICT DO NOTHING;