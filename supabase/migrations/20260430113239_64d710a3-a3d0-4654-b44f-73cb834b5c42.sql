-- Sprint: Active Users Source of Truth
-- View oficial de usuários ativos para selects/filtros operacionais

CREATE INDEX IF NOT EXISTS idx_organization_members_active_lookup
  ON public.organization_members (organization_id, status, deleted_at, user_id);

DROP VIEW IF EXISTS public.crm_active_users_view;

CREATE VIEW public.crm_active_users_view
WITH (security_invoker = true)
AS
SELECT
  om.organization_id                                      AS tenant_id,
  om.user_id                                              AS user_id,
  COALESCE(p.full_name, 'Usuário sem nome')               AS full_name,
  p.email                                                 AS email,
  p.avatar_url                                            AS avatar_url,
  om.org_role::text                                       AS org_role,
  om.status                                               AS status,
  NULL::text                                              AS profile_status,
  true                                                    AS is_active,
  om.created_at                                           AS created_at,
  om.joined_at                                            AS updated_at,
  ucv.permission_key                                      AS context_permission_key,
  ucv.department_key                                      AS context_department_key,
  ucv.business_function_key                               AS context_business_function_key,
  ucv.business_function_name                              AS context_business_function_name,
  ucv.department_name                                     AS context_department_name,
  ucv.is_dashboard_dynamic_enabled                        AS is_dashboard_dynamic_enabled
FROM public.organization_members om
LEFT JOIN public.profiles p
  ON p.user_id = om.user_id
LEFT JOIN public.crm_user_context_view ucv
  ON ucv.tenant_id = om.organization_id
 AND ucv.user_id   = om.user_id
WHERE om.deleted_at IS NULL
  AND lower(COALESCE(om.status, 'active')) = 'active';

COMMENT ON VIEW public.crm_active_users_view IS
  'Sprint Active Users SoT: fonte única para filtros/selects operacionais. Apenas usuários ativos do tenant (status=active, deleted_at IS NULL).';

GRANT SELECT ON public.crm_active_users_view TO authenticated;