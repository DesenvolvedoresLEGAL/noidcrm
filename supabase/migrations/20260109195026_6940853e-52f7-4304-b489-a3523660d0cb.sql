-- Add minimum_contract_months column to proposal_items to store product's contract requirement
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS minimum_contract_months integer DEFAULT 1;