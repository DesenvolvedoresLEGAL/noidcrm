-- Add team-related columns to ote_monthly_results
ALTER TABLE public.ote_monthly_results 
ADD COLUMN IF NOT EXISTS is_team_target BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS team_member_count INTEGER;