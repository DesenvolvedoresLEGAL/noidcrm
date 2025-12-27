
-- =====================================================
-- PROMPT MASTER: Campos PLG na tabela opportunities
-- =====================================================

-- 1. Adicionar campos PLG na tabela opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'pending';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS plg_score INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS activated_features JSONB DEFAULT '[]'::jsonb;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lead_type TEXT DEFAULT 'outbound';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_type TEXT DEFAULT 'sales_led';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS plg_organization_id UUID;

-- 2. Adicionar referência à organização do trial
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_opportunities_plg_organization'
  ) THEN
    ALTER TABLE opportunities 
    ADD CONSTRAINT fk_opportunities_plg_organization 
    FOREIGN KEY (plg_organization_id) 
    REFERENCES organizations(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Criar índices para busca otimizada
CREATE INDEX IF NOT EXISTS idx_opportunities_plg_org ON opportunities(plg_organization_id) WHERE plg_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_trial_status ON opportunities(trial_status) WHERE trial_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_lead_type ON opportunities(lead_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_opportunity_type ON opportunities(opportunity_type);

-- 4. Tornar owner_user_id nullable para permitir oportunidades PLG sem owner inicial
ALTER TABLE opportunities ALTER COLUMN owner_user_id DROP NOT NULL;

-- 5. Comentários para documentação
COMMENT ON COLUMN opportunities.trial_status IS 'Status do trial: pending, active, expired, converted, cancelled';
COMMENT ON COLUMN opportunities.trial_start_date IS 'Data de início do trial';
COMMENT ON COLUMN opportunities.trial_end_date IS 'Data de término do trial';
COMMENT ON COLUMN opportunities.plg_score IS 'Score de engajamento PLG (0-100)';
COMMENT ON COLUMN opportunities.activated_features IS 'Lista de features ativadas durante o trial';
COMMENT ON COLUMN opportunities.lead_type IS 'Tipo do lead: inbound_product, inbound_marketing, outbound';
COMMENT ON COLUMN opportunities.opportunity_type IS 'Tipo da oportunidade: product_led, sales_led, partner_led';
COMMENT ON COLUMN opportunities.plg_organization_id IS 'ID da organização em trial (para rastreabilidade e anti-duplicidade)';
