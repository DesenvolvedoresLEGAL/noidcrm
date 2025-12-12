-- Add is_team_target column to ote_levels to identify team-based goal levels
ALTER TABLE public.ote_levels 
ADD COLUMN is_team_target BOOLEAN NOT NULL DEFAULT false;

-- Update existing levels with order_index >= 7 (Driver/Gestor levels) to be team targets
UPDATE public.ote_levels 
SET is_team_target = true 
WHERE order_index >= 7;

-- Add comment for documentation
COMMENT ON COLUMN public.ote_levels.is_team_target IS 'When true, this level calculates goals based on team member sales, not individual sales';