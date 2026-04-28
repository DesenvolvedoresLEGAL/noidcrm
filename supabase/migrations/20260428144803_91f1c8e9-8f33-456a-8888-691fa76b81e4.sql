-- ============================================================================
-- SPRINT 4: Dashboard resolver foundation (preview only, no behavior change)
-- ============================================================================

-- 1. crm_dashboard_profiles --------------------------------------------------
create table if not exists public.crm_dashboard_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  key text not null,
  name text not null,
  description text,
  scope_type text not null,
  scope_key text not null,
  layout jsonb not null default '{}'::jsonb,
  widgets jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_dashboard_profiles_key_not_empty check (length(trim(key)) > 0),
  constraint crm_dashboard_profiles_name_not_empty check (length(trim(name)) > 0),
  constraint crm_dashboard_profiles_scope_type_valid check (
    scope_type in ('user', 'business_function', 'department', 'permission_role', 'default')
  ),
  constraint crm_dashboard_profiles_tenant_key_unique unique (tenant_id, key),
  constraint crm_dashboard_profiles_tenant_scope_unique unique (tenant_id, scope_type, scope_key)
);

create index if not exists idx_crm_dashboard_profiles_tenant_key
  on public.crm_dashboard_profiles (tenant_id, key);
create index if not exists idx_crm_dashboard_profiles_scope
  on public.crm_dashboard_profiles (tenant_id, scope_type, scope_key);
create index if not exists idx_crm_dashboard_profiles_active
  on public.crm_dashboard_profiles (tenant_id, is_active);

drop trigger if exists trg_crm_dashboard_profiles_updated_at on public.crm_dashboard_profiles;
create trigger trg_crm_dashboard_profiles_updated_at
  before update on public.crm_dashboard_profiles
  for each row execute function public.set_updated_at();

alter table public.crm_dashboard_profiles enable row level security;

drop policy if exists "tenant members can read crm dashboard profiles" on public.crm_dashboard_profiles;
create policy "tenant members can read crm dashboard profiles"
  on public.crm_dashboard_profiles
  for select
  using (public.user_belongs_to_tenant(tenant_id));

drop policy if exists "admins and owners can manage crm dashboard profiles" on public.crm_dashboard_profiles;
create policy "admins and owners can manage crm dashboard profiles"
  on public.crm_dashboard_profiles
  for all
  using (public.is_tenant_admin_or_owner(tenant_id))
  with check (public.is_tenant_admin_or_owner(tenant_id));

-- 2. crm_dashboard_resolution_logs (append only) -----------------------------
create table if not exists public.crm_dashboard_resolution_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  resolved_profile_id uuid null references public.crm_dashboard_profiles(id) on delete set null,
  resolved_profile_key text,
  resolution_source text not null,
  fallback_used boolean not null default false,
  fallback_reason text,
  dynamic_dashboards_enabled boolean not null default false,
  user_dashboard_enabled boolean not null default false,
  context_snapshot jsonb not null default '{}'::jsonb,
  candidate_profiles jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_dashboard_resolution_source_valid check (
    resolution_source in ('user', 'business_function', 'department', 'permission_role', 'default', 'legacy_fallback', 'error_fallback')
  )
);

create index if not exists idx_crm_dashboard_resolution_logs_user_created
  on public.crm_dashboard_resolution_logs (tenant_id, user_id, created_at desc);
create index if not exists idx_crm_dashboard_resolution_logs_source_created
  on public.crm_dashboard_resolution_logs (tenant_id, resolution_source, created_at desc);
create index if not exists idx_crm_dashboard_resolution_logs_fallback_created
  on public.crm_dashboard_resolution_logs (tenant_id, fallback_used, created_at desc);

alter table public.crm_dashboard_resolution_logs enable row level security;

drop policy if exists "admins and owners can read crm dashboard resolution logs" on public.crm_dashboard_resolution_logs;
create policy "admins and owners can read crm dashboard resolution logs"
  on public.crm_dashboard_resolution_logs
  for select
  using (public.is_tenant_admin_or_owner(tenant_id));

-- No insert/update/delete policies: writes happen exclusively via SECURITY DEFINER RPC.

-- 3. Idempotent seeds for every tenant present in crm_user_contexts ----------
do $$
declare
  v_tenant_id uuid;
  v_seeds jsonb := '[
    {"key":"dashboard_legacy_default","name":"Dashboard padrão legado","description":"Fallback para o dashboard atual do CRM.","scope_type":"default","scope_key":"default",
      "layout":{"type":"legacy","route":"current_dashboard","fallback":true},"widgets":[]},
    {"key":"dashboard_owner_placeholder","name":"Dashboard Owner","description":"Placeholder futuro para cockpit executivo.","scope_type":"permission_role","scope_key":"owner",
      "layout":{"type":"dynamic_placeholder","profile":"owner","status":"not_implemented_yet"},
      "widgets":[{"key":"revenue_overview","label":"Receita","status":"placeholder"},{"key":"forecast_ai","label":"Forecast AI","status":"placeholder"},{"key":"strategic_accounts","label":"Contas estratégicas","status":"placeholder"}]},
    {"key":"dashboard_admin_placeholder","name":"Dashboard Admin","description":"Placeholder futuro para governança do CRM.","scope_type":"permission_role","scope_key":"admin",
      "layout":{"type":"dynamic_placeholder","profile":"admin","status":"not_implemented_yet"},
      "widgets":[{"key":"crm_health","label":"Saúde do CRM","status":"placeholder"},{"key":"integrations","label":"Integrações","status":"placeholder"},{"key":"data_quality","label":"Qualidade de dados","status":"placeholder"}]},
    {"key":"dashboard_manager_placeholder","name":"Dashboard Manager","description":"Placeholder futuro para gestão de time e forecast.","scope_type":"permission_role","scope_key":"manager",
      "layout":{"type":"dynamic_placeholder","profile":"manager","status":"not_implemented_yet"},
      "widgets":[{"key":"team_goal","label":"Meta do time","status":"placeholder"},{"key":"team_pipeline","label":"Pipeline do time","status":"placeholder"},{"key":"coaching_alerts","label":"Alertas de coaching","status":"placeholder"}]},
    {"key":"dashboard_user_placeholder","name":"Dashboard Usuário","description":"Placeholder genérico para usuário operacional.","scope_type":"permission_role","scope_key":"user",
      "layout":{"type":"dynamic_placeholder","profile":"user","status":"not_implemented_yet"},
      "widgets":[{"key":"my_tasks","label":"Minhas tarefas","status":"placeholder"},{"key":"my_pipeline","label":"Meu pipeline","status":"placeholder"}]},
    {"key":"dashboard_sales_closer_placeholder","name":"Dashboard Closer","description":"Placeholder futuro para vendedores focados em fechamento.","scope_type":"business_function","scope_key":"closer",
      "layout":{"type":"dynamic_placeholder","profile":"closer","status":"not_implemented_yet"},
      "widgets":[{"key":"open_pipeline","label":"Pipeline aberto","status":"placeholder"},{"key":"proposals_viewed","label":"Propostas visualizadas","status":"placeholder"},{"key":"followups_due","label":"Follow ups pendentes","status":"placeholder"}]},
    {"key":"dashboard_pre_sales_sdr_placeholder","name":"Dashboard SDR","description":"Placeholder futuro para pré vendas e qualificação.","scope_type":"business_function","scope_key":"sdr",
      "layout":{"type":"dynamic_placeholder","profile":"sdr","status":"not_implemented_yet"},
      "widgets":[{"key":"new_leads","label":"Novos leads","status":"placeholder"},{"key":"first_contact_sla","label":"SLA de primeiro contato","status":"placeholder"},{"key":"qualified_leads","label":"Leads qualificados","status":"placeholder"}]},
    {"key":"dashboard_cs_placeholder","name":"Dashboard CS","description":"Placeholder futuro para retenção e sucesso do cliente.","scope_type":"business_function","scope_key":"cs",
      "layout":{"type":"dynamic_placeholder","profile":"cs","status":"not_implemented_yet"},
      "widgets":[{"key":"active_customers","label":"Clientes ativos","status":"placeholder"},{"key":"churn_risk","label":"Risco de churn","status":"placeholder"},{"key":"expansion_opportunities","label":"Oportunidades de expansão","status":"placeholder"}]},
    {"key":"dashboard_operations_placeholder","name":"Dashboard Operações","description":"Placeholder futuro para operação e suporte.","scope_type":"department","scope_key":"operations",
      "layout":{"type":"dynamic_placeholder","profile":"operations","status":"not_implemented_yet"},
      "widgets":[{"key":"open_tasks","label":"Tarefas abertas","status":"placeholder"},{"key":"support_load","label":"Carga de suporte","status":"placeholder"},{"key":"operational_alerts","label":"Alertas operacionais","status":"placeholder"}]},
    {"key":"dashboard_finance_placeholder","name":"Dashboard Financeiro","description":"Placeholder futuro para visão financeira.","scope_type":"department","scope_key":"finance",
      "layout":{"type":"dynamic_placeholder","profile":"finance","status":"not_implemented_yet"},
      "widgets":[{"key":"receivables","label":"Contas a receber","status":"placeholder"},{"key":"billing_alerts","label":"Alertas de cobrança","status":"placeholder"},{"key":"financial_summary","label":"Resumo financeiro","status":"placeholder"}]}
  ]'::jsonb;
  v_seed jsonb;
begin
  for v_tenant_id in
    select distinct tenant_id from public.crm_user_contexts where tenant_id is not null
  loop
    for v_seed in select * from jsonb_array_elements(v_seeds)
    loop
      insert into public.crm_dashboard_profiles (
        tenant_id, key, name, description, scope_type, scope_key,
        layout, widgets, is_system, is_active, metadata
      )
      values (
        v_tenant_id,
        v_seed->>'key',
        v_seed->>'name',
        v_seed->>'description',
        v_seed->>'scope_type',
        v_seed->>'scope_key',
        coalesce(v_seed->'layout', '{}'::jsonb),
        coalesce(v_seed->'widgets', '[]'::jsonb),
        true,
        true,
        jsonb_build_object('created_by_sprint', 'dashboard_resolver_sprint_4', 'seed', true)
      )
      on conflict (tenant_id, key) do nothing;
    end loop;
  end loop;
end $$;

-- 4. RPC: crm_resolve_dashboard_profile --------------------------------------
create or replace function public.crm_resolve_dashboard_profile(
  p_tenant_id uuid,
  p_user_id uuid,
  p_preview boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
begin
  -- Auth + tenant membership of caller
  if v_caller is null then
    raise exception 'not_authenticated';
  end if;
  if not public.user_belongs_to_tenant(p_tenant_id) then
    raise exception 'forbidden_tenant';
  end if;

  -- Target user must belong to the tenant via organization_members
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

  -- Feature flags
  select coalesce(bool_or(enabled) filter (where key = 'dynamic_dashboards_enabled'), false),
         coalesce(bool_or(enabled) filter (where key = 'dynamic_user_context_enabled'), false)
    into v_dynamic_dashboards_enabled, v_dynamic_user_context_enabled
  from public.crm_feature_flags
  where tenant_id = p_tenant_id;

  -- User context from view
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

  -- Build ordered candidate list
  v_ordered := jsonb_build_array(
    jsonb_build_object('scope_type','user','scope_key', p_user_id::text),
    jsonb_build_object('scope_type','business_function','scope_key', v_context.business_function_key),
    jsonb_build_object('scope_type','department','scope_key', v_context.department_key),
    jsonb_build_object('scope_type','permission_role','scope_key', v_context.permission_key),
    jsonb_build_object('scope_type','default','scope_key','default')
  );

  -- Iterate candidates and try to find first active profile
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
      v_resolution_source := v_scope_type;
      v_fallback_used := false;
      v_fallback_reason := null;

      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'scope_type', v_scope_type, 'scope_key', v_scope_key, 'matched', true, 'profile_key', v_profile.key
      ));
    else
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'scope_type', v_scope_type, 'scope_key', v_scope_key, 'matched', false
      ));
    end if;
  end loop;

  -- No match → legacy fallback
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

  -- If global flag is off but a non-legacy profile resolved, annotate fallback_reason
  if not v_fallback_used and not v_dynamic_dashboards_enabled then
    v_fallback_reason := 'dynamic_dashboards_disabled';
  end if;

  -- should_use_dynamic_dashboard rules
  v_should_use_dynamic := (
    p_preview = false
    and v_dynamic_dashboards_enabled = true
    and v_user_dashboard_enabled = true
    and v_resolved_profile_id is not null
    and v_fallback_used = false
    and coalesce(v_profile.layout->>'type', '') <> 'legacy'
  );

  -- Insert audit log (best-effort, never break the response)
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
        'created_by_sprint','dashboard_resolver_sprint_4',
        'preview', p_preview,
        'caller_user_id', v_caller
      )
    );
  exception when others then
    null;
  end;

  -- Build result jsonb
  if v_resolved_profile_id is not null then
    select jsonb_build_object(
      'id', dp.id,
      'key', dp.key,
      'name', dp.name,
      'scope_type', dp.scope_type,
      'scope_key', dp.scope_key,
      'layout', dp.layout,
      'widgets', dp.widgets,
      'description', dp.description
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
    )
  );

exception when others then
  -- error_fallback path: try to insert error log and return safe legacy result
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
      jsonb_build_object('created_by_sprint','dashboard_resolver_sprint_4','preview', p_preview, 'error', true, 'caller_user_id', v_caller)
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
    )
  );
end;
$$;

revoke all on function public.crm_resolve_dashboard_profile(uuid, uuid, boolean) from public;
grant execute on function public.crm_resolve_dashboard_profile(uuid, uuid, boolean) to authenticated;