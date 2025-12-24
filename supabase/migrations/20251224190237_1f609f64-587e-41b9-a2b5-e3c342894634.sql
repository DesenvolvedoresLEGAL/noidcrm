-- Add monthly_value column to contracts table for storing MRR from proposals
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS monthly_value numeric DEFAULT 0;

-- Add contract_type column if not exists
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'annual';

-- Add comment
COMMENT ON COLUMN public.contracts.monthly_value IS 'Monthly recurring revenue (MRR) from the associated proposal';