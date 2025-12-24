-- Add one_time_value column to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS one_time_value numeric DEFAULT 0;