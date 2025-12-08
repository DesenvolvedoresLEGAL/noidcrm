-- Create custom_forms table
CREATE TABLE public.custom_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL DEFAULT 'opportunity', -- opportunity, account, contact
  pipeline_ids TEXT[] DEFAULT '{}',
  activity_type_ids TEXT[] DEFAULT '{}',
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create custom_form_values table (filled form responses)
CREATE TABLE public.custom_form_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  custom_form_id UUID NOT NULL REFERENCES custom_forms(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  values JSONB NOT NULL DEFAULT '{}',
  filled_by UUID,
  filled_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(custom_form_id, entity_id)
);

-- Enable RLS
ALTER TABLE public.custom_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_form_values ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_forms
CREATE POLICY "Users can view org custom forms"
  ON public.custom_forms FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can insert org custom forms"
  ON public.custom_forms FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND user_is_org_admin(organization_id));

CREATE POLICY "Admins can update org custom forms"
  ON public.custom_forms FOR UPDATE
  USING (organization_id = get_user_organization_id() AND user_is_org_admin(organization_id));

CREATE POLICY "Admins can delete org custom forms"
  ON public.custom_forms FOR DELETE
  USING (organization_id = get_user_organization_id() AND user_is_org_admin(organization_id));

-- RLS policies for custom_form_values
CREATE POLICY "Users can view org custom form values"
  ON public.custom_form_values FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org custom form values"
  ON public.custom_form_values FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org custom form values"
  ON public.custom_form_values FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete org custom form values"
  ON public.custom_form_values FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Indexes for performance
CREATE INDEX idx_custom_forms_org ON public.custom_forms(organization_id);
CREATE INDEX idx_custom_forms_entity_type ON public.custom_forms(entity_type);
CREATE INDEX idx_custom_form_values_form ON public.custom_form_values(custom_form_id);
CREATE INDEX idx_custom_form_values_entity ON public.custom_form_values(entity_id);

-- Trigger for updated_at
CREATE TRIGGER update_custom_forms_updated_at
  BEFORE UPDATE ON public.custom_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_form_values_updated_at
  BEFORE UPDATE ON public.custom_form_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();