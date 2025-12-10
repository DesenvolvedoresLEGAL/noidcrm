
-- Add new columns to plans table for promotional pricing
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS promo_price_cents integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS promo_limit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS promo_accounts_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0;

-- Delete old plans (keeping internal_full)
DELETE FROM public.plan_entitlements WHERE plan_id IN ('free', 'trial', 'starter', 'pro', 'enterprise');
DELETE FROM public.plans WHERE id IN ('free', 'trial', 'starter', 'pro', 'enterprise');

-- Insert new plans
INSERT INTO public.plans (id, name, price_month_cents, price_year_cents, promo_price_cents, promo_limit, promo_accounts_used, trial_days)
VALUES 
  ('freemium', 'Freemium', 0, 0, 0, 0, 0, 30),
  ('neural', 'Neural', 29990, 287900, 19990, 100, 0, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_month_cents = EXCLUDED.price_month_cents,
  price_year_cents = EXCLUDED.price_year_cents,
  promo_price_cents = EXCLUDED.promo_price_cents,
  promo_limit = EXCLUDED.promo_limit,
  trial_days = EXCLUDED.trial_days;

-- Update internal_full plan
UPDATE public.plans SET 
  promo_price_cents = 0,
  promo_limit = 0,
  promo_accounts_used = 0,
  trial_days = 0
WHERE id = 'internal_full';

-- Insert Freemium entitlements (limited)
INSERT INTO public.plan_entitlements (plan_id, key, value) VALUES
  ('freemium', 'max_users', '1'),
  ('freemium', 'max_pipelines', '1'),
  ('freemium', 'max_opportunities', '50'),
  ('freemium', 'max_contacts', '100'),
  ('freemium', 'max_accounts', '50'),
  ('freemium', 'ai_enabled', 'false'),
  ('freemium', 'automations_enabled', 'false'),
  ('freemium', 'sequences_enabled', 'false'),
  ('freemium', 'advanced_reports', 'false'),
  ('freemium', 'api_access', 'false')
ON CONFLICT DO NOTHING;

-- Insert Neural entitlements (unlimited)
INSERT INTO public.plan_entitlements (plan_id, key, value) VALUES
  ('neural', 'max_users', '999999'),
  ('neural', 'max_pipelines', '999999'),
  ('neural', 'max_opportunities', '999999'),
  ('neural', 'max_contacts', '999999'),
  ('neural', 'max_accounts', '999999'),
  ('neural', 'ai_enabled', 'true'),
  ('neural', 'automations_enabled', 'true'),
  ('neural', 'sequences_enabled', 'true'),
  ('neural', 'advanced_reports', 'true'),
  ('neural', 'api_access', 'true'),
  ('neural', 'priority_support', 'true')
ON CONFLICT DO NOTHING;
