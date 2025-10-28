-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create organization_settings table
CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their organization settings"
  ON public.organization_settings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Admins and owners can manage organization settings"
  ON public.organization_settings
  FOR ALL
  USING (
    user_is_org_admin(organization_id)
  )
  WITH CHECK (
    user_is_org_admin(organization_id)
  );

-- Create updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_organization_settings_org_id ON public.organization_settings(organization_id);