-- Create default permission sets for the organization
INSERT INTO permission_sets (name, description, is_system, permissions, organization_id)
SELECT 
  'Vendedor Padrão',
  'Permissões padrão para vendedores - acesso limitado a configurações',
  true,
  '{
    "deals": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": false},
    "contacts": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": false},
    "activities": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": false},
    "reports": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "settings": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "automation": {"view": false, "create": false, "edit": false, "delete": false, "viewAll": false},
    "teams": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false}
  }'::jsonb,
  o.id
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = o.id AND ps.name = 'Vendedor Padrão'
);

INSERT INTO permission_sets (name, description, is_system, permissions, organization_id)
SELECT 
  'Gerente de Equipe',
  'Permissões para gerentes - acesso parcial a configurações',
  true,
  '{
    "deals": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "activities": {"view": true, "create": true, "edit": true, "delete": true, "viewAll": true},
    "reports": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true},
    "settings": {"view": true, "create": false, "edit": true, "delete": false, "viewAll": false},
    "automation": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "teams": {"view": true, "create": true, "edit": true, "delete": false, "viewAll": true}
  }'::jsonb,
  o.id
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = o.id AND ps.name = 'Gerente de Equipe'
);

INSERT INTO permission_sets (name, description, is_system, permissions, organization_id)
SELECT 
  'Visualizador',
  'Permissões somente leitura',
  true,
  '{
    "deals": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "contacts": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "activities": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "reports": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false},
    "settings": {"view": false, "create": false, "edit": false, "delete": false, "viewAll": false},
    "automation": {"view": false, "create": false, "edit": false, "delete": false, "viewAll": false},
    "teams": {"view": true, "create": false, "edit": false, "delete": false, "viewAll": false}
  }'::jsonb,
  o.id
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM permission_sets ps 
  WHERE ps.organization_id = o.id AND ps.name = 'Visualizador'
);

-- Create helper function to check settings access level
CREATE OR REPLACE FUNCTION public.get_user_settings_access_level(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN org_role IN ('owner', 'admin') THEN 'full'
      WHEN org_role = 'manager' THEN 'partial'
      ELSE 'basic'
    END
  FROM organization_members
  WHERE user_id = _user_id
    AND status = 'active'
  ORDER BY joined_at DESC NULLS LAST
  LIMIT 1;
$$;