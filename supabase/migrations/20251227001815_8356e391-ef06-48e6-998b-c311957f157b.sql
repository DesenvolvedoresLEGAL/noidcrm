-- =======================================================
-- TRIAL EXPIRADO (PLG) - Database Structure
-- =======================================================

-- 1. Add plg_classification column to opportunities table
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS plg_classification TEXT CHECK (plg_classification IN ('hot', 'warm', 'cold'));

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_opportunities_plg_classification 
ON opportunities(plg_classification) 
WHERE plg_classification IS NOT NULL;

-- 2. Create stage "Trial Expirado (PLG)" in PRÉ VENDAS pipeline
INSERT INTO stages (
  id, 
  pipeline_id, 
  name, 
  description, 
  order_index, 
  color, 
  probability, 
  stagnation_alert_days, 
  organization_id,
  allow_create_opportunity, 
  allow_win_opportunity, 
  allow_lose_opportunity
) VALUES (
  'trial-expired-plg-stage',
  '774d7d78-8257-4891-aac7-718039b80049-sales-1',
  'Trial Expirado (PLG)',
  'Trial expirou. PLG Score define prioridade (hot/warm/cold). Aguarda ação humana ou playbook de reativação.',
  3,
  '#F97316',
  5,
  7,
  '774d7d78-8257-4891-aac7-718039b80049',
  false, 
  false, 
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color;

-- 3. Create classification tags for trial expired
INSERT INTO tags (organization_id, name, color, is_active) VALUES
('774d7d78-8257-4891-aac7-718039b80049', 'trial_expired_hot', '#EF4444', true),
('774d7d78-8257-4891-aac7-718039b80049', 'trial_expired_warm', '#F59E0B', true),
('774d7d78-8257-4891-aac7-718039b80049', 'trial_expired_cold', '#3B82F6', true)
ON CONFLICT DO NOTHING;