-- Add billing type fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'one_time' 
  CHECK (billing_type IN ('one_time', 'recurring'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly'
  CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannual', 'annual'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS monthly_price numeric;

ALTER TABLE products ADD COLUMN IF NOT EXISTS minimum_contract_months integer DEFAULT 12;

-- Add MRR fields to opportunities for accurate forecasting
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS mrr_value numeric DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS arr_value numeric DEFAULT 0;

-- Add billing type to proposal_items to track item-level billing
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS billing_type text DEFAULT 'one_time'
  CHECK (billing_type IN ('one_time', 'recurring'));

-- Add contract fields to proposal_payment_terms
ALTER TABLE proposal_payment_terms ADD COLUMN IF NOT EXISTS contract_start_date date;
ALTER TABLE proposal_payment_terms ADD COLUMN IF NOT EXISTS contract_duration_months integer DEFAULT 12;
ALTER TABLE proposal_payment_terms ADD COLUMN IF NOT EXISTS billing_day integer DEFAULT 10;
ALTER TABLE proposal_payment_terms ADD COLUMN IF NOT EXISTS auto_renewal boolean DEFAULT true;

-- Create index for billing type queries
CREATE INDEX IF NOT EXISTS idx_products_billing_type ON products(billing_type);
CREATE INDEX IF NOT EXISTS idx_proposal_items_billing_type ON proposal_items(billing_type);