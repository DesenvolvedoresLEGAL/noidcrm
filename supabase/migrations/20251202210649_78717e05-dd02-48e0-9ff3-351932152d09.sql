-- Create measurement_units table
CREATE TABLE public.measurement_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, abbreviation)
);

-- Enable RLS
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org measurement units"
ON public.measurement_units FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage measurement units"
ON public.measurement_units FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_measurement_units_updated_at
BEFORE UPDATE ON public.measurement_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data for existing organizations
INSERT INTO public.measurement_units (organization_id, name, abbreviation, is_default)
SELECT id, 'Unidade', 'un', true FROM organizations
UNION ALL
SELECT id, 'Hora', 'hr', false FROM organizations
UNION ALL
SELECT id, 'Dia', 'dia', false FROM organizations
UNION ALL
SELECT id, 'Mês', 'mês', false FROM organizations
UNION ALL
SELECT id, 'Quilograma', 'kg', false FROM organizations
UNION ALL
SELECT id, 'Litro', 'l', false FROM organizations
UNION ALL
SELECT id, 'Metro', 'm', false FROM organizations
UNION ALL
SELECT id, 'Metro²', 'm²', false FROM organizations
UNION ALL
SELECT id, 'Caixa', 'cx', false FROM organizations;