-- Add missing stage fields so the app can persist them
-- SAFE: allow NULLs and no constraints to avoid breaking existing data
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS probability integer,
  ADD COLUMN IF NOT EXISTS stagnation_alert_days integer,
  ADD COLUMN IF NOT EXISTS allow_create_opportunity boolean,
  ADD COLUMN IF NOT EXISTS allow_win_opportunity boolean,
  ADD COLUMN IF NOT EXISTS allow_lose_opportunity boolean;

-- Optional: comment for documentation
COMMENT ON COLUMN public.stages.description IS 'Long-form description of the stage';
COMMENT ON COLUMN public.stages.probability IS 'Win probability percentage (0-100)';
COMMENT ON COLUMN public.stages.stagnation_alert_days IS 'Days without movement before alert';
COMMENT ON COLUMN public.stages.allow_create_opportunity IS 'Whether new opps can be created in this stage';
COMMENT ON COLUMN public.stages.allow_win_opportunity IS 'Whether opps can be marked as won in this stage';
COMMENT ON COLUMN public.stages.allow_lose_opportunity IS 'Whether opps can be marked as lost in this stage';