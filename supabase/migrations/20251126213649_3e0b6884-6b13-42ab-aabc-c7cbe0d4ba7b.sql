-- Create sync_logs table for tracking all synchronization operations
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('email', 'calendar')),
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'partial', 'failed')),
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_created INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sync_logs
CREATE POLICY "Users can view their own sync logs"
  ON public.sync_logs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert sync logs"
  ON public.sync_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update sync logs"
  ON public.sync_logs
  FOR UPDATE
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON public.sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_organization_id ON public.sync_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON public.sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs(created_at DESC);