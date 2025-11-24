-- Sprint 3: Email and Calendar Sync Tables

-- Email sync configuration
CREATE TABLE IF NOT EXISTS public.email_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  email_address TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_from_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  auto_log_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Calendar sync configuration
CREATE TABLE IF NOT EXISTS public.calendar_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
  calendar_id TEXT,
  calendar_name TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_from_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  auto_log_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider, calendar_id)
);

-- Sync logs for tracking operations
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('email', 'calendar')),
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sync metadata to activities table
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS sync_source TEXT CHECK (sync_source IN ('email', 'calendar', 'manual')),
ADD COLUMN IF NOT EXISTS sync_provider TEXT CHECK (sync_provider IN ('gmail', 'outlook', 'google')),
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS external_link TEXT,
ADD COLUMN IF NOT EXISTS sync_metadata JSONB;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activities_sync_source ON public.activities(sync_source);
CREATE INDEX IF NOT EXISTS idx_activities_external_id ON public.activities(external_id);
CREATE INDEX IF NOT EXISTS idx_email_sync_config_user ON public.email_sync_config(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_config_user ON public.calendar_sync_config(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_type ON public.sync_logs(user_id, sync_type);

-- Enable RLS
ALTER TABLE public.email_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_sync_config
CREATE POLICY "Users manage own email sync config"
ON public.email_sync_config
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for calendar_sync_config
CREATE POLICY "Users manage own calendar sync config"
ON public.calendar_sync_config
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for sync_logs
CREATE POLICY "Users view own sync logs"
ON public.sync_logs
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System creates sync logs"
ON public.sync_logs
FOR INSERT
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_email_sync_config_updated_at
  BEFORE UPDATE ON public.email_sync_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_sync_config_updated_at
  BEFORE UPDATE ON public.calendar_sync_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically set sync_source to manual if not specified
CREATE OR REPLACE FUNCTION public.set_default_sync_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sync_source IS NULL THEN
    NEW.sync_source := 'manual';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_activity_sync_source
  BEFORE INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_sync_source();