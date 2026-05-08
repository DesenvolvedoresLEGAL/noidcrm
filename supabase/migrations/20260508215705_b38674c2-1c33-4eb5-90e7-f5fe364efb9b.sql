-- Proposals: snapshot + public payment flag
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS public_payment_enabled boolean,
  ADD COLUMN IF NOT EXISTS approval_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_amount numeric,
  ADD COLUMN IF NOT EXISTS approved_payment_schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_dynamic_pricing_tier_id uuid;

-- Organizations: global flag
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS public_payment_enabled boolean NOT NULL DEFAULT false;

-- Payment terms: condition + split strategy
ALTER TABLE public.proposal_payment_terms
  ADD COLUMN IF NOT EXISTS payment_condition text NOT NULL DEFAULT 'upfront',
  ADD COLUMN IF NOT EXISTS second_payment_due_strategy text,
  ADD COLUMN IF NOT EXISTS second_payment_due_date date;

-- Sanity check on payment_condition values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_payment_terms_payment_condition_check'
  ) THEN
    ALTER TABLE public.proposal_payment_terms
      ADD CONSTRAINT proposal_payment_terms_payment_condition_check
      CHECK (payment_condition IN ('upfront','split_50_50','split_30_70','installments','custom_schedule'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_payment_terms_second_due_strategy_check'
  ) THEN
    ALTER TABLE public.proposal_payment_terms
      ADD CONSTRAINT proposal_payment_terms_second_due_strategy_check
      CHECK (second_payment_due_strategy IS NULL OR second_payment_due_strategy IN ('post_event','after_valid_until','manual_date'));
  END IF;
END $$;