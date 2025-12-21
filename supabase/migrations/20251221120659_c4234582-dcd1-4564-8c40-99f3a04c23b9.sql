-- Add counts_for_commission to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS counts_for_commission BOOLEAN NOT NULL DEFAULT true;

-- Add counts_for_commission to proposal_items table
ALTER TABLE proposal_items 
ADD COLUMN IF NOT EXISTS counts_for_commission BOOLEAN NOT NULL DEFAULT true;

-- Add commission_value to opportunities table (value that counts for goals/commissions)
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS commission_value NUMERIC(15,2) DEFAULT 0;

-- Update existing opportunities to have commission_value equal to valor_previsto
UPDATE opportunities 
SET commission_value = COALESCE(valor_previsto, 0)
WHERE commission_value IS NULL OR commission_value = 0;

-- Add comment for documentation
COMMENT ON COLUMN products.counts_for_commission IS 'If true, this product counts towards sales goals and commissions';
COMMENT ON COLUMN proposal_items.counts_for_commission IS 'If true, this item counts towards sales goals and commissions';
COMMENT ON COLUMN opportunities.commission_value IS 'Total value of items that count for commission (subset of valor_previsto)';