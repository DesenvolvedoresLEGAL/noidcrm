-- Create activity_participants table for multiple users involved in activities
CREATE TABLE IF NOT EXISTS public.activity_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'participant', 'optional')),
  is_confirmed BOOLEAN DEFAULT false,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

-- Enable RLS
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view participants in their org"
  ON public.activity_participants
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert participants in their org"
  ON public.activity_participants
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update participants in their org"
  ON public.activity_participants
  FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete participants in their org"
  ON public.activity_participants
  FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Add index for performance
CREATE INDEX idx_activity_participants_activity_id ON public.activity_participants(activity_id);
CREATE INDEX idx_activity_participants_user_id ON public.activity_participants(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_activity_participants_updated_at
  BEFORE UPDATE ON public.activity_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();