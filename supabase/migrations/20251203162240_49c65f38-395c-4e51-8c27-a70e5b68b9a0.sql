-- Custom Field Groups table
CREATE TABLE public.custom_field_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'contact', 'opportunity', 'proposal', 'activity', 'product')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Custom Fields table
CREATE TABLE public.custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.custom_field_groups(id) ON DELETE SET NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'currency', 'date', 'datetime', 'boolean', 'select', 'multi_select', 'email', 'phone', 'url', 'user', 'formula')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'contact', 'opportunity', 'proposal', 'activity', 'product')),
  options JSONB DEFAULT '[]'::jsonb,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  visibility_config JSONB DEFAULT '{"locations": ["form_create", "form_edit", "detail_page"], "permissions": {"view": ["all"], "edit": ["all"]}}'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  help_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, entity_type, field_key)
);

-- Custom Field Values table
CREATE TABLE public.custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'contact', 'opportunity', 'proposal', 'activity', 'product')),
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(custom_field_id, entity_id)
);

-- Dynamic Variables table
CREATE TABLE public.dynamic_variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  source_entity TEXT,
  source_field TEXT,
  format_type TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_custom_fields_org_entity ON public.custom_fields(organization_id, entity_type);
CREATE INDEX idx_custom_fields_group ON public.custom_fields(group_id);
CREATE INDEX idx_custom_field_values_entity ON public.custom_field_values(entity_id, entity_type);
CREATE INDEX idx_custom_field_values_field ON public.custom_field_values(custom_field_id);
CREATE INDEX idx_dynamic_variables_org ON public.dynamic_variables(organization_id);
CREATE INDEX idx_custom_field_groups_org_entity ON public.custom_field_groups(organization_id, entity_type);

-- Enable RLS
ALTER TABLE public.custom_field_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_variables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_field_groups
CREATE POLICY "Users can view org custom field groups"
ON public.custom_field_groups FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage custom field groups"
ON public.custom_field_groups FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- RLS Policies for custom_fields
CREATE POLICY "Users can view org custom fields"
ON public.custom_fields FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage custom fields"
ON public.custom_fields FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- RLS Policies for custom_field_values
CREATE POLICY "Users can view org custom field values"
ON public.custom_field_values FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can manage custom field values in their org"
ON public.custom_field_values FOR ALL
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- RLS Policies for dynamic_variables
CREATE POLICY "Users can view system and org dynamic variables"
ON public.dynamic_variables FOR SELECT
USING (is_system = true OR organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage org dynamic variables"
ON public.dynamic_variables FOR ALL
USING (is_system = false AND user_is_org_admin(organization_id))
WITH CHECK (is_system = false AND user_is_org_admin(organization_id));

-- Updated_at triggers
CREATE TRIGGER update_custom_field_groups_updated_at
BEFORE UPDATE ON public.custom_field_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_fields_updated_at
BEFORE UPDATE ON public.custom_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_field_values_updated_at
BEFORE UPDATE ON public.custom_field_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dynamic_variables_updated_at
BEFORE UPDATE ON public.dynamic_variables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed system dynamic variables (from proposalVariables.ts)
INSERT INTO public.dynamic_variables (variable_key, label, category, description, source_entity, source_field, is_system, is_active) VALUES
-- Organization variables
('org_nome', 'Nome da Empresa', 'Organização', 'Nome da organização', 'organization', 'name', true, true),
('org_cnpj', 'CNPJ', 'Organização', 'CNPJ formatado da organização', 'organization', 'cnpj', true, true),
('org_endereco', 'Endereço Completo', 'Organização', 'Endereço completo da organização', 'organization', 'address', true, true),
('org_telefone', 'Telefone', 'Organização', 'Telefone da organização', 'organization', 'phone', true, true),
('org_email', 'E-mail', 'Organização', 'E-mail da organização', 'organization', 'email', true, true),
('org_website', 'Website', 'Organização', 'Website da organização', 'organization', 'website', true, true),
-- Client variables
('cliente_nome', 'Nome do Cliente', 'Cliente', 'Razão social ou nome fantasia', 'account', 'nome_fantasia', true, true),
('cliente_razao_social', 'Razão Social', 'Cliente', 'Razão social do cliente', 'account', 'razao_social', true, true),
('cliente_cnpj', 'CNPJ do Cliente', 'Cliente', 'CNPJ formatado do cliente', 'account', 'cnpj', true, true),
('cliente_endereco', 'Endereço do Cliente', 'Cliente', 'Endereço completo do cliente', 'account', 'endereco', true, true),
('cliente_cidade', 'Cidade', 'Cliente', 'Cidade do cliente', 'account', 'cidade', true, true),
('cliente_estado', 'Estado', 'Cliente', 'UF do cliente', 'account', 'uf', true, true),
('cliente_telefone', 'Telefone do Cliente', 'Cliente', 'Telefone do cliente', 'account', 'telefone', true, true),
('cliente_email', 'E-mail do Cliente', 'Cliente', 'E-mail do cliente', 'account', 'email', true, true),
-- Contact variables
('contato_nome', 'Nome do Contato', 'Contato', 'Nome do contato principal', 'contact', 'nome', true, true),
('contato_cargo', 'Cargo do Contato', 'Contato', 'Cargo do contato', 'contact', 'cargo', true, true),
('contato_email', 'E-mail do Contato', 'Contato', 'E-mail do contato', 'contact', 'email', true, true),
('contato_telefone', 'Telefone do Contato', 'Contato', 'Telefone do contato', 'contact', 'telefone', true, true),
-- Proposal variables
('proposta_numero', 'Número da Proposta', 'Proposta', 'Número gerado da proposta', 'proposal', 'proposal_number', true, true),
('proposta_versao', 'Versão', 'Proposta', 'Versão da proposta', 'proposal', 'proposal_version', true, true),
('proposta_titulo', 'Título', 'Proposta', 'Título da proposta', 'proposal', 'title', true, true),
('proposta_valor', 'Valor Total', 'Proposta', 'Valor total formatado', 'proposal', 'value', true, true),
('proposta_validade', 'Data de Validade', 'Proposta', 'Data de validade formatada', 'proposal', 'expires_at', true, true),
('proposta_data_criacao', 'Data de Criação', 'Proposta', 'Data de criação da proposta', 'proposal', 'created_at', true, true),
-- Owner/Salesperson variables
('vendedor_nome', 'Nome do Vendedor', 'Vendedor', 'Nome completo do vendedor', 'owner', 'full_name', true, true),
('vendedor_email', 'E-mail do Vendedor', 'Vendedor', 'E-mail do vendedor', 'owner', 'email', true, true),
('vendedor_telefone', 'Telefone do Vendedor', 'Vendedor', 'Telefone do vendedor', 'owner', 'phone', true, true),
-- Date variables
('data_hoje', 'Data de Hoje', 'Data', 'Data atual formatada (DD/MM/YYYY)', 'system', 'current_date', true, true),
('data_hoje_extenso', 'Data por Extenso', 'Data', 'Data atual por extenso', 'system', 'current_date_extended', true, true),
('hora_atual', 'Hora Atual', 'Data', 'Hora atual (HH:MM)', 'system', 'current_time', true, true);