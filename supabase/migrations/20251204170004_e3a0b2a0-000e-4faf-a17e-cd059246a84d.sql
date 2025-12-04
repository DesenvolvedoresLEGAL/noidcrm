-- Sprint 2: Advanced Tracking for Proposal Analytics

-- 1. Add new columns to proposal_views for enhanced tracking
ALTER TABLE public.proposal_views
ADD COLUMN IF NOT EXISTS scroll_depth_percent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sections_viewed text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS time_per_section jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS interactions jsonb DEFAULT '{"clicks": 0, "copied_text": false, "downloaded_pdf": false, "printed": false}',
ADD COLUMN IF NOT EXISTS referrer text,
ADD COLUMN IF NOT EXISTS is_forwarded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS viewport_width integer,
ADD COLUMN IF NOT EXISTS viewport_height integer,
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS view_end_at timestamptz;

-- 2. Create proposal_view_events table for granular tracking
CREATE TABLE IF NOT EXISTS public.proposal_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  view_id uuid REFERENCES public.proposal_views(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  event_type text NOT NULL, -- 'scroll', 'click', 'section_enter', 'section_exit', 'copy', 'download', 'print'
  event_data jsonb DEFAULT '{}',
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proposal_view_events_proposal_id ON public.proposal_view_events(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_view_events_view_id ON public.proposal_view_events(view_id);
CREATE INDEX IF NOT EXISTS idx_proposal_view_events_session_id ON public.proposal_view_events(session_id);
CREATE INDEX IF NOT EXISTS idx_proposal_view_events_event_type ON public.proposal_view_events(event_type);
CREATE INDEX IF NOT EXISTS idx_proposal_view_events_timestamp ON public.proposal_view_events(timestamp DESC);

-- Add index for forward detection on proposal_views
CREATE INDEX IF NOT EXISTS idx_proposal_views_viewer_ip ON public.proposal_views(proposal_id, viewer_ip);

-- Enable RLS on proposal_view_events
ALTER TABLE public.proposal_view_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for proposal_view_events (public insert for tracking, org-based read)
CREATE POLICY "Public can insert view events"
  ON public.proposal_view_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals 
      WHERE id = proposal_view_events.proposal_id 
      AND public_token IS NOT NULL
    )
  );

CREATE POLICY "Users can view events for their org proposals"
  ON public.proposal_view_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_view_events.proposal_id
      AND p.organization_id = get_user_organization_id()
    )
  );

-- 3. Create a function to detect if view is from different IP (potential forward)
CREATE OR REPLACE FUNCTION public.detect_proposal_forward(p_proposal_id uuid, p_viewer_ip text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_ips_count integer;
BEGIN
  -- Count distinct IPs that have viewed this proposal
  SELECT COUNT(DISTINCT viewer_ip) INTO existing_ips_count
  FROM proposal_views
  WHERE proposal_id = p_proposal_id
    AND viewer_ip IS NOT NULL
    AND viewer_ip != p_viewer_ip;
  
  -- If there are other IPs, this could be a forward
  RETURN existing_ips_count > 0;
END;
$$;