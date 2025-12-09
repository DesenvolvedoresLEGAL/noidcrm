-- Add new columns to permission_sets for dashboard and menu configuration
ALTER TABLE public.permission_sets 
ADD COLUMN IF NOT EXISTS default_dashboard TEXT DEFAULT 'RepDashboard',
ADD COLUMN IF NOT EXISTS visible_menus JSONB DEFAULT '["principal", "gestao"]'::jsonb,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing permission sets with appropriate defaults
UPDATE public.permission_sets 
SET 
  default_dashboard = 'OwnerDashboard',
  visible_menus = '["principal", "gestao", "inteligencia", "gtm"]'::jsonb,
  description = 'Acesso total ao sistema'
WHERE name ILIKE '%admin%' OR name ILIKE '%owner%' OR name ILIKE '%full%';

UPDATE public.permission_sets 
SET 
  default_dashboard = 'ManagerDashboard',
  visible_menus = '["principal", "gestao", "inteligencia"]'::jsonb,
  description = 'Acesso de gestão de equipe'
WHERE name ILIKE '%manager%' OR name ILIKE '%gestor%';

UPDATE public.permission_sets 
SET 
  default_dashboard = 'RepDashboard',
  visible_menus = '["principal", "gestao"]'::jsonb,
  description = 'Acesso padrão de vendedor'
WHERE name ILIKE '%sales%' OR name ILIKE '%vendedor%' OR name ILIKE '%rep%';

-- Create default permission sets if they don't exist
INSERT INTO public.permission_sets (organization_id, name, description, permissions, default_dashboard, visible_menus)
SELECT 
  org.id,
  'Administrador',
  'Acesso total ao sistema com todas as permissões',
  '{
    "deals": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "activities": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "reports": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "settings": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "automation": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "teams": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true}
  }'::jsonb,
  'OwnerDashboard',
  '["principal", "gestao", "inteligencia", "gtm"]'::jsonb
FROM organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = org.id AND ps.name = 'Administrador'
);

INSERT INTO public.permission_sets (organization_id, name, description, permissions, default_dashboard, visible_menus)
SELECT 
  org.id,
  'Gestor',
  'Acesso de gestão com visibilidade de equipe',
  '{
    "deals": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true},
    "activities": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "reports": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true},
    "settings": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "automation": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true},
    "teams": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true}
  }'::jsonb,
  'ManagerDashboard',
  '["principal", "gestao", "inteligencia"]'::jsonb
FROM organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = org.id AND ps.name = 'Gestor'
);

INSERT INTO public.permission_sets (organization_id, name, description, permissions, default_dashboard, visible_menus)
SELECT 
  org.id,
  'Vendedor',
  'Acesso padrão para equipe de vendas',
  '{
    "deals": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": false},
    "contacts": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": false},
    "activities": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": false},
    "reports": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "settings": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "automation": {"view": false, "create": false, "edit": false, "delete": false, "viewAll": false},
    "teams": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false}
  }'::jsonb,
  'RepDashboard',
  '["principal", "gestao"]'::jsonb
FROM organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = org.id AND ps.name = 'Vendedor'
);

INSERT INTO public.permission_sets (organization_id, name, description, permissions, default_dashboard, visible_menus)
SELECT 
  org.id,
  'Financeiro',
  'Acesso focado em relatórios e métricas financeiras',
  '{
    "deals": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": true},
    "contacts": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": true},
    "activities": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": true},
    "reports": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true},
    "settings": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "automation": {"view": false, "create": false, "edit": false, "delete": false, "viewAll": false},
    "teams": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": true}
  }'::jsonb,
  'FinanceDashboard',
  '["principal", "gestao", "inteligencia"]'::jsonb
FROM organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = org.id AND ps.name = 'Financeiro'
);

INSERT INTO public.permission_sets (organization_id, name, description, permissions, default_dashboard, visible_menus)
SELECT 
  org.id,
  'Customer Success',
  'Acesso focado em relacionamento com clientes',
  '{
    "deals": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": false},
    "contacts": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true},
    "activities": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": false},
    "reports": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "settings": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "automation": {"view": false, "create": false, "edit": false, "delete": false, "viewAll": false},
    "teams": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false}
  }'::jsonb,
  'CSDashboard',
  '["principal", "gestao", "inteligencia"]'::jsonb
FROM organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = org.id AND ps.name = 'Customer Success'
);