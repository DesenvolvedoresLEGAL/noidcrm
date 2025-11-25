-- Create origin_groups table
CREATE TABLE IF NOT EXISTS public.origin_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create origins table
CREATE TABLE IF NOT EXISTS public.origins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.origin_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.origin_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for origin_groups
CREATE POLICY "Users can view org origin groups"
ON public.origin_groups
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage origin groups"
ON public.origin_groups
FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- RLS Policies for origins
CREATE POLICY "Users can view org origins"
ON public.origins
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage origins"
ON public.origins
FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- Create updated_at triggers
CREATE TRIGGER update_origin_groups_updated_at
BEFORE UPDATE ON public.origin_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_origins_updated_at
BEFORE UPDATE ON public.origins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data: Create origin groups and origins for all organizations
DO $$
DECLARE
  org_record RECORD;
  farmers_group_id UUID;
  inbound_group_id UUID;
  outbound_group_id UUID;
BEGIN
  FOR org_record IN SELECT id FROM public.organizations LOOP
    -- Create Farmers group
    INSERT INTO public.origin_groups (organization_id, name, description, is_active)
    VALUES (org_record.id, 'Farmers', 'Clientes que já existem na base e podem gerar novas oportunidades', true)
    RETURNING id INTO farmers_group_id;

    -- Create Inbound Marketing group
    INSERT INTO public.origin_groups (organization_id, name, description, is_active)
    VALUES (org_record.id, 'Inbound Marketing', 'Leads que chegam através de ações de marketing de atração', true)
    RETURNING id INTO inbound_group_id;

    -- Create Outbound Marketing group
    INSERT INTO public.origin_groups (organization_id, name, description, is_active)
    VALUES (org_record.id, 'Outbound Marketing', 'Prospecção ativa e ações de marketing direto', true)
    RETURNING id INTO outbound_group_id;

    -- Farmers origins
    INSERT INTO public.origins (organization_id, group_id, name, is_active) VALUES
    (org_record.id, farmers_group_id, 'Base de Clientes', true),
    (org_record.id, farmers_group_id, 'Upsell', true),
    (org_record.id, farmers_group_id, 'Cross-sell', true);

    -- Inbound Marketing origins
    INSERT INTO public.origins (organization_id, group_id, name, is_active) VALUES
    (org_record.id, inbound_group_id, 'Google Ads', true),
    (org_record.id, inbound_group_id, 'Redes Sociais', true),
    (org_record.id, inbound_group_id, 'Site', true),
    (org_record.id, inbound_group_id, 'Blog', true),
    (org_record.id, inbound_group_id, 'Indicação', true);

    -- Outbound Marketing origins
    INSERT INTO public.origins (organization_id, group_id, name, is_active) VALUES
    (org_record.id, outbound_group_id, 'Prospecção Ativa (Cold Call)', true),
    (org_record.id, outbound_group_id, 'Prospecção Ativa (Email)', true),
    (org_record.id, outbound_group_id, 'Prospecção Ativa (LinkedIn)', true),
    (org_record.id, outbound_group_id, 'Lista Comprada', true),
    (org_record.id, outbound_group_id, 'Evento', true);
  END LOOP;
END $$;