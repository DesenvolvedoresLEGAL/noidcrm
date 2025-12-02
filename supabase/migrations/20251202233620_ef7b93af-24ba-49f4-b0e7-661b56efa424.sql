-- Sprint 7B: Proposal Collaboration & Analytics

-- 1. Create proposal_participants table for multi-user collaboration
CREATE TABLE public.proposal_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator', 'reviewer', 'approver')),
  can_edit BOOLEAN DEFAULT false,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

-- 2. Add columns to proposal_views for better analytics
ALTER TABLE public.proposal_views 
ADD COLUMN IF NOT EXISTS section_views JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS browser TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- 3. Create proposal_alerts table for smart alerts
CREATE TABLE public.proposal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('high_engagement', 'price_focus', 'multiple_views', 'long_session', 'stale_proposal', 'pending_approval')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'success', 'critical')),
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.proposal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_alerts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for proposal_participants
CREATE POLICY "Users can view proposal participants in their org"
ON public.proposal_participants FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND status = 'active'
));

CREATE POLICY "Users can manage proposal participants in their org"
ON public.proposal_participants FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND status = 'active'
));

CREATE POLICY "Users can update proposal participants in their org"
ON public.proposal_participants FOR UPDATE
USING (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND status = 'active'
));

CREATE POLICY "Users can delete proposal participants in their org"
ON public.proposal_participants FOR DELETE
USING (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND status = 'active'
));

-- 6. RLS Policies for proposal_alerts
CREATE POLICY "Users can view proposal alerts in their org"
ON public.proposal_alerts FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND status = 'active'
));

CREATE POLICY "System can insert proposal alerts"
ON public.proposal_alerts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update proposal alerts in their org"
ON public.proposal_alerts FOR UPDATE
USING (organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND status = 'active'
));

-- 7. Create indexes for performance
CREATE INDEX idx_proposal_participants_proposal ON public.proposal_participants(proposal_id);
CREATE INDEX idx_proposal_participants_user ON public.proposal_participants(user_id);
CREATE INDEX idx_proposal_alerts_proposal ON public.proposal_alerts(proposal_id);
CREATE INDEX idx_proposal_alerts_unread ON public.proposal_alerts(proposal_id, is_read) WHERE NOT is_read;

-- 8. Add updated_at trigger for proposal_participants
CREATE TRIGGER update_proposal_participants_updated_at
BEFORE UPDATE ON public.proposal_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();