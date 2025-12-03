-- Expand proposal_templates table with new fields for world-class template editor
ALTER TABLE proposal_templates 
ADD COLUMN IF NOT EXISTS layout_id UUID REFERENCES proposal_layouts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS control_prefix VARCHAR(10),
ADD COLUMN IF NOT EXISTS observations TEXT,
ADD COLUMN IF NOT EXISTS payment_method_default VARCHAR(50),
ADD COLUMN IF NOT EXISTS installments_default INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS entry_percent_default DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent_default DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS entry_days_default INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_interval_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS due_day_default INTEGER,
ADD COLUMN IF NOT EXISTS payment_comment TEXT,
ADD COLUMN IF NOT EXISTS mrr_payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS mrr_first_payment_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS mrr_due_day INTEGER,
ADD COLUMN IF NOT EXISTS mrr_comment TEXT;

-- Add index for layout_id
CREATE INDEX IF NOT EXISTS idx_proposal_templates_layout_id ON proposal_templates(layout_id);