-- Add briefing_type and coaching fields to daily_briefings
ALTER TABLE public.daily_briefings 
ADD COLUMN IF NOT EXISTS briefing_type text DEFAULT 'sales',
ADD COLUMN IF NOT EXISTS coaching_insights jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS strategic_recommendations jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS team_highlights jsonb DEFAULT '[]'::jsonb;

-- Add index for faster lookups by type
CREATE INDEX IF NOT EXISTS idx_daily_briefings_type ON public.daily_briefings(briefing_type);
CREATE INDEX IF NOT EXISTS idx_daily_briefings_date_type ON public.daily_briefings(briefing_date, briefing_type);