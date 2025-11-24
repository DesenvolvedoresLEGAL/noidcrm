-- Create import_logs table for tracking data imports
CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('accounts', 'contacts', 'opportunities')),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
  success_count INTEGER DEFAULT 0 CHECK (success_count >= 0),
  error_count INTEGER DEFAULT 0 CHECK (error_count >= 0),
  warning_count INTEGER DEFAULT 0 CHECK (warning_count >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_logs
CREATE POLICY "Users can view org import logs"
  ON public.import_logs
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert own import logs"
  ON public.import_logs
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id() 
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own import logs"
  ON public.import_logs
  FOR UPDATE
  USING (
    organization_id = get_user_organization_id() 
    AND user_id = auth.uid()
  );

-- Create index for performance
CREATE INDEX idx_import_logs_org_user ON public.import_logs(organization_id, user_id);
CREATE INDEX idx_import_logs_created_at ON public.import_logs(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_import_logs_updated_at
  BEFORE UPDATE ON public.import_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();