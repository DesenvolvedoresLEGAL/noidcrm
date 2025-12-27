-- Add NRHS columns to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS nrhs_score integer,
ADD COLUMN IF NOT EXISTS nrhs_tier text,
ADD COLUMN IF NOT EXISTS nrhs_last_calculated_at timestamptz,
ADD COLUMN IF NOT EXISTS nrhs_breakdown jsonb,
ADD COLUMN IF NOT EXISTS nrhs_issues_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS nrhs_blockers jsonb DEFAULT '[]'::jsonb;

-- Create index for NRHS filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_nrhs_score ON public.opportunities(nrhs_score);
CREATE INDEX IF NOT EXISTS idx_opportunities_nrhs_tier ON public.opportunities(nrhs_tier);

-- Create nrhs_events table for audit trail
CREATE TABLE IF NOT EXISTS public.nrhs_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('calculated', 'issue_added', 'issue_resolved', 'tier_changed')),
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Enable RLS on nrhs_events
ALTER TABLE public.nrhs_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for nrhs_events (using organization_members like opportunities)
CREATE POLICY "Users can view nrhs_events in their organization"
ON public.nrhs_events FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert nrhs_events in their organization"
ON public.nrhs_events FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- Create opportunities_weekly_review table
CREATE TABLE IF NOT EXISTS public.opportunities_weekly_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reviewed_at timestamptz DEFAULT now(),
  notes text,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on opportunities_weekly_review
ALTER TABLE public.opportunities_weekly_review ENABLE ROW LEVEL SECURITY;

-- RLS policies for opportunities_weekly_review
CREATE POLICY "Users can view weekly reviews in their organization"
ON public.opportunities_weekly_review FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert weekly reviews in their organization"
ON public.opportunities_weekly_review FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their own weekly reviews"
ON public.opportunities_weekly_review FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own weekly reviews"
ON public.opportunities_weekly_review FOR DELETE
USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nrhs_events_opportunity_id ON public.nrhs_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_nrhs_events_created_at ON public.nrhs_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_review_opportunity_id ON public.opportunities_weekly_review(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_weekly_review_reviewed_at ON public.opportunities_weekly_review(reviewed_at DESC);