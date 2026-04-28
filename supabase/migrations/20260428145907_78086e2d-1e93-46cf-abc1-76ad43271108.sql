
-- =====================================================================
-- Sprint 4.1: Resolver hardening + Admin Center
-- =====================================================================

-- 1) Rename admin profile name (keep key for backwards compat)
UPDATE public.crm_dashboard_profiles
SET name = 'Admin Center',
    description = 'Área de gestão e configuração do CRM. Permissão Admin libera gestão do CRM, mas o dashboard principal segue a função/área do usuário.',
    metadata = metadata || jsonb_build_object('is_admin_center', true, 'not_a_home_dashboard', true)
WHERE scope_type = 'permission_role'
  AND scope_key = 'admin'
  AND key = 'dashboard_admin_placeholder';

-- 2) Add metadata flag to owner profile so we can detect it as cockpit
UPDATE public.crm_dashboard_profiles
SET metadata = metadata || jsonb_build_object('is_owner_cockpit', true)
WHERE scope_type = 'permission_role'
  AND scope_key = 'owner'
  AND key = 'dashboard_owner_placeholder';

-- 3) Seed missing business_function profiles for every tenant (idempotent)
INSERT INTO public.crm_dashboard_profiles (
  tenant_id, key, name, description, scope_type, scope_key,
  layout, widgets, filters, permissions, metadata, is_system, is_active
)
SELECT
  t.tenant_id,
  bf.key,
  bf.name,
  bf.description,
  'business_function',
  bf.scope_key,
  jsonb_build_object('type','placeholder','columns',2),
  bf.widgets,
  '{}'::jsonb,
  '{}'::jsonb,
  jsonb_build_object('seed_sprint','sprint_4_1','placeholder',true),
  true,
  true
FROM (SELECT DISTINCT tenant_id FROM public.crm_dashboard_profiles) t
CROSS JOIN (
  VALUES
    ('owner',             'dashboard_function_owner_placeholder',             'Cockpit Executivo (Owner)',          'Visão executiva do negócio para fundadores e sócios.',
       jsonb_build_array(
         jsonb_build_object('id','exec_revenue','title','Receita consolidada','type','placeholder'),
         jsonb_build_object('id','exec_pipeline','title','Pipeline saúde','type','placeholder'),
         jsonb_build_object('id','exec_team','title','Time e produtividade','type','placeholder')
       )),
    ('director',          'dashboard_function_director_placeholder',          'Cockpit Diretoria',                  'Visão estratégica para diretores e líderes de área.',
       jsonb_build_array(
         jsonb_build_object('id','dir_kpis','title','KPIs por área','type','placeholder'),
         jsonb_build_object('id','dir_forecast','title','Forecast consolidado','type','placeholder')
       )),
    ('finance_admin',     'dashboard_function_finance_admin_placeholder',     'Operação Financeira',                'Visão de operação financeira: faturamento, contratos, recebíveis.',
       jsonb_build_array(
         jsonb_build_object('id','fin_billing','title','Faturamento','type','placeholder'),
         jsonb_build_object('id','fin_contracts','title','Contratos ativos','type','placeholder')
       )),
    ('operations',        'dashboard_function_operations_placeholder',        'Operações',                          'Visão de operação interna e processos.',
       jsonb_build_array(
         jsonb_build_object('id','ops_tasks','title','Tarefas operacionais','type','placeholder'),
         jsonb_build_object('id','ops_sla','title','SLA de processos','type','placeholder')
       )),
    ('technical_support', 'dashboard_function_technical_support_placeholder', 'Suporte Técnico',                    'Visão de fila de tickets, SLAs e satisfação.',
       jsonb_build_array(
         jsonb_build_object('id','sup_tickets','title','Tickets abertos','type','placeholder'),
         jsonb_build_object('id','sup_csat','title','Satisfação','type','placeholder')
       )),
    ('dev',               'dashboard_function_dev_placeholder',               'Engenharia',                         'Visão de entregas, deploys e backlog técnico.',
       jsonb_build_array(
         jsonb_build_object('id','dev_releases','title','Releases','type','placeholder'),
         jsonb_build_object('id','dev_backlog','title','Backlog técnico','type','placeholder')
       )),
    ('automation',        'dashboard_function_automation_placeholder',        'Automação / RevOps',                 'Visão de automações, workflows e agentes.',
       jsonb_build_array(
         jsonb_build_object('id','auto_workflows','title','Workflows ativos','type','placeholder'),
         jsonb_build_object('id','auto_agents','title','Agentes IA','type','placeholder')
       ))
) AS bf(scope_key, key, name, description, widgets)
ON CONFLICT (tenant_id, scope_type, scope_key) DO NOTHING;

-- 4) Update resolver: Owner permission ALWAYS resolves to owner cockpit,
--    overriding business_function and department.
CREATE OR REPLACE FUNCTION public.crm_resolve_dashboard_profile(p_tenant_id uuid, p_user_id uuid, p_preview boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_context record;
  v_dynamic_dashboards_enabled boolean := false;
  v_dynamic_user_context_enabled boolean := false;
  v_user_dashboard_enabled boolean := false;
  v_candidates jsonb := '[]'::jsonb;
  v_profile record;
  v_resolution_source text := 'legacy_fallback';
  v_fallback_used boolean := true;
  v_fallback_reason text := 'missing_user_context';
  v_resolved_profile_id uuid := null;
  v_resolved_profile_key text := null;
  v_should_use_dynamic boolean := false;
  v_context_snapshot jsonb := '{}'::jsonb;
  v_result jsonb;
  v_member_exists boolean;
  v_scope_type text;
  v_scope_key text;
  v_match record;
  v_ordered jsonb := '[]'::jsonb;
  v_owner_override boolean := false;
begin
  if v_caller is null then
    raise exception 'not_authenticated';
  end if;
  if not public.user_belongs_to_tenant(p_tenant_id) then
    raise exception 'forbidden_tenant';
  end if;

  select exists(
    select 1 from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = p_user_id
      and o.tenant_id = p_tenant_id
      and om.status in ('active','suspended')
  ) into v_member_exists;

  if not v_member_exists then
    raise exception 'target_user_not_in_tenant';
  end if;

  select coalesce(bool_or(enabled) filter (where key = 'dynamic_dashboards_enabled'), false),
         coalesce(bool_or(enabled) filter (where key = 'dynamic_user_context_enabled'), false)
    into v_dynamic_dashboards_enabled, v_dynamic_user_context_enabled
  from public.crm_feature_flags
  where tenant_id = p_tenant_id;

  select *
    into v_context
  from public.crm_user_context_view
  where tenant_id = p_tenant_id and user_id = p_user_id
  limit 1;

  v_user_dashboard_enabled := coalesce(v_context.is_dashboard_dynamic_enabled, false);

  v_context_snapshot := jsonb_build_object(
    'permission_key', v_context.permission_key,
    'department_key', v_context.department_key,
    'business_function_key', v_context.business_function_key,
    'is_dashboard_dynamic_enabled', v_user_dashboard_enabled,
    'requires_review', coalesce((v_context.metadata->>'requires_review')::boolean, false)
  );

  -- =================================================================
  -- OWNER OVERRIDE: Owner permission ALWAYS resolves to owner cockpit,
  -- regardless of business_function or department mapping.
  -- =================================================================
  v_owner_override := (lower(coalesce(v_context.permission_key, '')) = 'owner');

  if v_owner_override then
    v_ordered := jsonb_build_array(
      jsonb_build_object('scope_type','user','scope_key', p_user_id::text),
      jsonb_build_object('scope_type','permission_role','scope_key','owner'),
      jsonb_build_object('scope_type','business_function','scope_key', v_context.business_function_key),
      jsonb_build_object('scope_type','department','scope_key', v_context.department_key),
      jsonb_build_object('scope_type','default','scope_key','default')
    );
  else
    v_ordered := jsonb_build_array(
      jsonb_build_object('scope_type','user','scope_key', p_user_id::text),
      jsonb_build_object('scope_type','business_function','scope_key', v_context.business_function_key),
      jsonb_build_object('scope_type','department','scope_key', v_context.department_key),
      jsonb_build_object('scope_type','permission_role','scope_key', v_context.permission_key),
      jsonb_build_object('scope_type','default','scope_key','default')
    );
  end if;

  v_candidates := '[]'::jsonb;
  for v_match in
    select (elem->>'scope_type') as scope_type,
           (elem->>'scope_key')  as scope_key,
           ord
    from jsonb_array_elements(v_ordered) with ordinality as t(elem, ord)
  loop
    v_scope_type := v_match.scope_type;
    v_scope_key  := v_match.scope_key;

    if v_scope_key is null or length(trim(v_scope_key)) = 0 then
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'scope_type', v_scope_type, 'scope_key', null, 'matched', false, 'reason', 'empty_scope_key'
      ));
      continue;
    end if;

    select * into v_profile
    from public.crm_dashboard_profiles
    where tenant_id = p_tenant_id
      and is_active = true
      and scope_type = v_scope_type
      and scope_key = v_scope_key
    limit 1;

    if found and v_resolved_profile_id is null then
      v_resolved_profile_id := v_profile.id;
      v_resolved_profile_key := v_profile.key;
      v_resolution_source := case
        when v_owner_override and v_scope_type = 'permission_role' and v_scope_key = 'owner'
          then 'owner_override'
        else v_scope_type
      end;
      v_fallback_used := false;
      v_fallback_reason := null;

      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'scope_type', v_scope_type, 'scope_key', v_scope_key, 'matched', true, 'profile_key', v_profile.key,
        'owner_override', (v_owner_override and v_scope_type = 'permission_role' and v_scope_key = 'owner')
      ));
    else
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'scope_type', v_scope_type, 'scope_key', v_scope_key, 'matched', false
      ));
    end if;
  end loop;

  if v_resolved_profile_id is null then
    select * into v_profile
    from public.crm_dashboard_profiles
    where tenant_id = p_tenant_id
      and is_active = true
      and scope_type = 'default'
      and scope_key = 'default'
    limit 1;

    if found then
      v_resolved_profile_id := v_profile.id;
      v_resolved_profile_key := v_profile.key;
    end if;
    v_resolution_source := 'legacy_fallback';
    v_fallback_used := true;
    if v_context.user_id is null then
      v_fallback_reason := 'missing_user_context';
    else
      v_fallback_reason := 'no_matching_profile';
    end if;
  end if;

  if not v_fallback_used and not v_dynamic_dashboards_enabled then
    v_fallback_reason := 'dynamic_dashboards_disabled';
  end if;

  v_should_use_dynamic := (
    p_preview = false
    and v_dynamic_dashboards_enabled = true
    and v_user_dashboard_enabled = true
    and v_resolved_profile_id is not null
    and v_fallback_used = false
    and coalesce(v_profile.layout->>'type', '') <> 'legacy'
  );

  begin
    insert into public.crm_dashboard_resolution_logs (
      tenant_id, user_id, resolved_profile_id, resolved_profile_key,
      resolution_source, fallback_used, fallback_reason,
      dynamic_dashboards_enabled, user_dashboard_enabled,
      context_snapshot, candidate_profiles, metadata
    ) values (
      p_tenant_id, p_user_id, v_resolved_profile_id, v_resolved_profile_key,
      v_resolution_source, v_fallback_used, v_fallback_reason,
      v_dynamic_dashboards_enabled, v_user_dashboard_enabled,
      v_context_snapshot, v_candidates,
      jsonb_build_object(
        'created_by_sprint','dashboard_resolver_sprint_4_1',
        'preview', p_preview,
        'caller_user_id', v_caller,
        'owner_override', v_owner_override
      )
    );
  exception when others then
    null;
  end;

  if v_resolved_profile_id is not null then
    select jsonb_build_object(
      'id', dp.id,
      'key', dp.key,
      'name', dp.name,
      'scope_type', dp.scope_type,
      'scope_key', dp.scope_key,
      'layout', dp.layout,
      'widgets', dp.widgets,
      'description', dp.description,
      'metadata', dp.metadata
    ) into v_result
    from public.crm_dashboard_profiles dp
    where dp.id = v_resolved_profile_id;
  else
    v_result := null;
  end if;

  return jsonb_build_object(
    'success', true,
    'mode', case when p_preview then 'preview' else 'live' end,
    'should_use_dynamic_dashboard', v_should_use_dynamic,
    'resolved_profile', v_result,
    'resolution_source', v_resolution_source,
    'fallback_used', v_fallback_used,
    'fallback_reason', v_fallback_reason,
    'context', v_context_snapshot,
    'candidate_profiles', v_candidates,
    'flags', jsonb_build_object(
      'dynamic_dashboards_enabled', v_dynamic_dashboards_enabled,
      'dynamic_user_context_enabled', v_dynamic_user_context_enabled
    ),
    'owner_override', v_owner_override
  );

exception when others then
  begin
    insert into public.crm_dashboard_resolution_logs (
      tenant_id, user_id, resolution_source, fallback_used, fallback_reason,
      dynamic_dashboards_enabled, user_dashboard_enabled, context_snapshot, candidate_profiles, metadata
    ) values (
      p_tenant_id, p_user_id, 'error_fallback', true, left(SQLERRM, 200),
      coalesce(v_dynamic_dashboards_enabled, false),
      coalesce(v_user_dashboard_enabled, false),
      coalesce(v_context_snapshot, '{}'::jsonb),
      coalesce(v_candidates, '[]'::jsonb),
      jsonb_build_object('created_by_sprint','dashboard_resolver_sprint_4_1','preview', p_preview, 'error', true, 'caller_user_id', v_caller)
    );
  exception when others then null;
  end;

  return jsonb_build_object(
    'success', false,
    'mode', case when p_preview then 'preview' else 'live' end,
    'should_use_dynamic_dashboard', false,
    'resolved_profile', null,
    'resolution_source', 'error_fallback',
    'fallback_used', true,
    'fallback_reason', 'resolver_error',
    'context', '{}'::jsonb,
    'candidate_profiles', '[]'::jsonb,
    'flags', jsonb_build_object(
      'dynamic_dashboards_enabled', false,
      'dynamic_user_context_enabled', false
    ),
    'owner_override', false
  );
end;
$function$;
