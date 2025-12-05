-- Dashboard preferences per role
CREATE TABLE public.dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL CHECK (role_type IN ('rep', 'manager', 'admin', 'owner')),
  layout_config JSONB DEFAULT '{}'::jsonb,
  widgets_order TEXT[] DEFAULT ARRAY[]::TEXT[],
  hidden_widgets TEXT[] DEFAULT ARRAY[]::TEXT[],
  refresh_interval INTEGER DEFAULT 300, -- seconds
  theme_preference TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_type)
);

-- Enable RLS
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own dashboard preferences"
ON public.dashboard_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own dashboard preferences"
ON public.dashboard_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own dashboard preferences"
ON public.dashboard_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own dashboard preferences"
ON public.dashboard_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_dashboard_preferences_updated_at
BEFORE UPDATE ON public.dashboard_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_dashboard_preferences_user_role ON public.dashboard_preferences(user_id, role_type);