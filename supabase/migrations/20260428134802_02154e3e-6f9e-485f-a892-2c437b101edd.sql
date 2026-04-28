-- ============================================================
-- SPRINT 1: Fundação de Permissão / Área / Função
-- ============================================================

-- 1. Extensão
create extension if not exists pgcrypto;

-- 2. Helper de updated_at (idempotente)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. Helpers de segurança por tenant (NOVOS — não substituem nada)
create or replace function public.user_belongs_to_tenant(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = _tenant_id
      and user_id = auth.uid()
      and status = 'active'
      and deleted_at is null
  );
$$;

create or replace function public.is_tenant_admin_or_owner(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = _tenant_id
      and user_id = auth.uid()
      and status = 'active'
      and deleted_at is null
      and org_role in ('owner', 'admin')
  );
$$;

-- ============================================================
-- 4. TABELAS
-- ============================================================

create table if not exists public.crm_permission_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  key text not null,
  name text not null,
  description text,
  level int not null default 10,
  is_system boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_permission_roles_key_not_empty check (length(trim(key)) > 0),
  constraint crm_permission_roles_name_not_empty check (length(trim(name)) > 0),
  constraint crm_permission_roles_level_valid check (level >= 1 and level <= 100),
  unique (tenant_id, key)
);

create table if not exists public.crm_departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  key text not null,
  name text not null,
  description text,
  sort_order int not null default 100,
  is_system boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_departments_key_not_empty check (length(trim(key)) > 0),
  constraint crm_departments_name_not_empty check (length(trim(name)) > 0),
  unique (tenant_id, key)
);

create table if not exists public.crm_business_functions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  department_id uuid references public.crm_departments(id) on delete set null,
  key text not null,
  name text not null,
  description text,
  function_group text,
  is_sales_related boolean not null default false,
  is_system boolean not null default false,
  is_active boolean not null default true,
  dashboard_profile_key text,
  automation_profile_key text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_business_functions_key_not_empty check (length(trim(key)) > 0),
  constraint crm_business_functions_name_not_empty check (length(trim(name)) > 0),
  unique (tenant_id, key)
);

create table if not exists public.crm_user_contexts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  permission_role_id uuid references public.crm_permission_roles(id) on delete set null,
  department_id uuid references public.crm_departments(id) on delete set null,
  business_function_id uuid references public.crm_business_functions(id) on delete set null,
  manager_user_id uuid,
  legacy_user_type text,
  legacy_commercial_function text,
  status text not null default 'active',
  is_dashboard_dynamic_enabled boolean not null default false,
  is_automation_dynamic_enabled boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_user_contexts_status_valid check (status in ('active', 'inactive', 'pending', 'blocked')),
  unique (tenant_id, user_id)
);

create table if not exists public.crm_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  key text not null,
  name text,
  description text,
  enabled boolean not null default false,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_feature_flags_key_not_empty check (length(trim(key)) > 0),
  unique (tenant_id, key)
);

-- ============================================================
-- 5. ÍNDICES
-- ============================================================

create index if not exists idx_crm_permission_roles_tenant_key on public.crm_permission_roles (tenant_id, key);
create index if not exists idx_crm_permission_roles_tenant_active on public.crm_permission_roles (tenant_id, is_active);
create index if not exists idx_crm_departments_tenant_key on public.crm_departments (tenant_id, key);
create index if not exists idx_crm_departments_tenant_active on public.crm_departments (tenant_id, is_active);
create index if not exists idx_crm_business_functions_tenant_key on public.crm_business_functions (tenant_id, key);
create index if not exists idx_crm_business_functions_department on public.crm_business_functions (tenant_id, department_id);
create index if not exists idx_crm_business_functions_tenant_active on public.crm_business_functions (tenant_id, is_active);
create index if not exists idx_crm_user_contexts_tenant_user on public.crm_user_contexts (tenant_id, user_id);
create index if not exists idx_crm_user_contexts_permission on public.crm_user_contexts (tenant_id, permission_role_id);
create index if not exists idx_crm_user_contexts_department on public.crm_user_contexts (tenant_id, department_id);
create index if not exists idx_crm_user_contexts_business_function on public.crm_user_contexts (tenant_id, business_function_id);
create index if not exists idx_crm_feature_flags_tenant_key on public.crm_feature_flags (tenant_id, key);

-- ============================================================
-- 6. TRIGGERS updated_at
-- ============================================================

drop trigger if exists trg_crm_permission_roles_updated_at on public.crm_permission_roles;
create trigger trg_crm_permission_roles_updated_at before update on public.crm_permission_roles for each row execute function public.set_updated_at();

drop trigger if exists trg_crm_departments_updated_at on public.crm_departments;
create trigger trg_crm_departments_updated_at before update on public.crm_departments for each row execute function public.set_updated_at();

drop trigger if exists trg_crm_business_functions_updated_at on public.crm_business_functions;
create trigger trg_crm_business_functions_updated_at before update on public.crm_business_functions for each row execute function public.set_updated_at();

drop trigger if exists trg_crm_user_contexts_updated_at on public.crm_user_contexts;
create trigger trg_crm_user_contexts_updated_at before update on public.crm_user_contexts for each row execute function public.set_updated_at();

drop trigger if exists trg_crm_feature_flags_updated_at on public.crm_feature_flags;
create trigger trg_crm_feature_flags_updated_at before update on public.crm_feature_flags for each row execute function public.set_updated_at();

-- ============================================================
-- 7. RLS
-- ============================================================

alter table public.crm_permission_roles enable row level security;
alter table public.crm_departments enable row level security;
alter table public.crm_business_functions enable row level security;
alter table public.crm_user_contexts enable row level security;
alter table public.crm_feature_flags enable row level security;

-- SELECT policies
drop policy if exists "tenant members can read crm permission roles" on public.crm_permission_roles;
create policy "tenant members can read crm permission roles" on public.crm_permission_roles for select using (public.user_belongs_to_tenant(tenant_id));

drop policy if exists "tenant members can read crm departments" on public.crm_departments;
create policy "tenant members can read crm departments" on public.crm_departments for select using (public.user_belongs_to_tenant(tenant_id));

drop policy if exists "tenant members can read crm business functions" on public.crm_business_functions;
create policy "tenant members can read crm business functions" on public.crm_business_functions for select using (public.user_belongs_to_tenant(tenant_id));

drop policy if exists "tenant members can read crm user contexts" on public.crm_user_contexts;
create policy "tenant members can read crm user contexts" on public.crm_user_contexts for select using (public.user_belongs_to_tenant(tenant_id));

drop policy if exists "tenant members can read crm feature flags" on public.crm_feature_flags;
create policy "tenant members can read crm feature flags" on public.crm_feature_flags for select using (public.user_belongs_to_tenant(tenant_id));

-- ALL (admin/owner) policies
drop policy if exists "admins and owners can manage crm permission roles" on public.crm_permission_roles;
create policy "admins and owners can manage crm permission roles" on public.crm_permission_roles for all using (public.is_tenant_admin_or_owner(tenant_id)) with check (public.is_tenant_admin_or_owner(tenant_id));

drop policy if exists "admins and owners can manage crm departments" on public.crm_departments;
create policy "admins and owners can manage crm departments" on public.crm_departments for all using (public.is_tenant_admin_or_owner(tenant_id)) with check (public.is_tenant_admin_or_owner(tenant_id));

drop policy if exists "admins and owners can manage crm business functions" on public.crm_business_functions;
create policy "admins and owners can manage crm business functions" on public.crm_business_functions for all using (public.is_tenant_admin_or_owner(tenant_id)) with check (public.is_tenant_admin_or_owner(tenant_id));

drop policy if exists "admins and owners can manage crm user contexts" on public.crm_user_contexts;
create policy "admins and owners can manage crm user contexts" on public.crm_user_contexts for all using (public.is_tenant_admin_or_owner(tenant_id)) with check (public.is_tenant_admin_or_owner(tenant_id));

drop policy if exists "admins and owners can manage crm feature flags" on public.crm_feature_flags;
create policy "admins and owners can manage crm feature flags" on public.crm_feature_flags for all using (public.is_tenant_admin_or_owner(tenant_id)) with check (public.is_tenant_admin_or_owner(tenant_id));

-- ============================================================
-- 8. SEEDS IDEMPOTENTES (para todas as organizations existentes)
-- ============================================================

do $$
declare
  org record;
  perms text[][] := array[
    array['owner','Owner','Acesso máximo ao tenant, visão executiva e controle total.','100'],
    array['admin','Admin','Administração completa do CRM, configurações, usuários, automações e dados.','90'],
    array['manager','Manager','Gestão de time, forecast, pipeline, coaching e relatórios gerenciais.','70'],
    array['user','User','Usuário operacional padrão, com acesso conforme área e função.','40'],
    array['viewer','Viewer','Usuário somente leitura, com acesso limitado a informações permitidas.','10']
  ];
  depts text[][] := array[
    array['pre_sales','Pré vendas','Captação, qualificação e passagem de oportunidades para vendas.','10'],
    array['sales','Vendas','Gestão de oportunidades, propostas, negociação e fechamento.','20'],
    array['customer_success','Customer Success','Retenção, expansão, relacionamento e sucesso do cliente.','30'],
    array['finance','Financeiro','Gestão financeira, contratos, cobranças e controles administrativos.','40'],
    array['operations','Operações','Execução operacional, implantação, atendimento e processos internos.','50'],
    array['it','TI','Tecnologia, suporte técnico, integrações, automações e infraestrutura.','60'],
    array['executive','Diretoria','Visão executiva, governança, resultados e tomada de decisão.','70']
  ];
  -- key, name, dept_key, function_group, dashboard, automation, sales_related
  funcs text[][] := array[
    array['sdr','SDR','pre_sales','Pré vendas','dashboard_sdr','automation_sdr','true'],
    array['bdr','BDR','pre_sales','Pré vendas','dashboard_bdr','automation_bdr','true'],
    array['ldr','LDR','pre_sales','Pré vendas','dashboard_ldr','automation_ldr','true'],
    array['ae','AE','sales','Vendas','dashboard_ae','automation_ae','true'],
    array['closer','Closer','sales','Vendas','dashboard_closer','automation_closer','true'],
    array['hunter','Hunter','sales','Vendas','dashboard_hunter','automation_hunter','true'],
    array['cs','CS','customer_success','Customer Success','dashboard_cs','automation_cs','true'],
    array['am','Account Manager','customer_success','Customer Success','dashboard_am','automation_am','true'],
    array['farmer','Farmer','customer_success','Customer Success','dashboard_farmer','automation_farmer','true'],
    array['finance','Financeiro','finance','Financeiro','dashboard_finance','automation_finance','false'],
    array['finance_admin','ADM Financeiro','finance','Financeiro','dashboard_finance_admin','automation_finance_admin','false'],
    array['operations','Operacional','operations','Operações','dashboard_operations','automation_operations','false'],
    array['support','Suporte','operations','Operações','dashboard_support','automation_support','false'],
    array['technical_support','Suporte Técnico','it','TI','dashboard_technical_support','automation_technical_support','false'],
    array['dev','Dev','it','TI','dashboard_dev','automation_dev','false'],
    array['automation','Automação','it','TI','dashboard_automation','automation_automation','false'],
    array['director','Diretor','executive','Diretoria','dashboard_director','automation_director','false'],
    array['owner','Owner','executive','Diretoria','dashboard_owner','automation_owner','false'],
    array['viewer','Visualizador','executive','Diretoria','dashboard_viewer','automation_viewer','false']
  ];
  i int;
  dept_id uuid;
begin
  for org in select id from public.organizations loop
    -- Permissions
    for i in 1..array_length(perms, 1) loop
      insert into public.crm_permission_roles (tenant_id, key, name, description, level, is_system)
      values (org.id, perms[i][1], perms[i][2], perms[i][3], perms[i][4]::int, true)
      on conflict (tenant_id, key) do update
        set name = excluded.name,
            description = excluded.description,
            level = excluded.level,
            is_system = true;
    end loop;

    -- Departments
    for i in 1..array_length(depts, 1) loop
      insert into public.crm_departments (tenant_id, key, name, description, sort_order, is_system)
      values (org.id, depts[i][1], depts[i][2], depts[i][3], depts[i][4]::int, true)
      on conflict (tenant_id, key) do update
        set name = excluded.name,
            description = excluded.description,
            sort_order = excluded.sort_order,
            is_system = true;
    end loop;

    -- Business functions
    for i in 1..array_length(funcs, 1) loop
      select id into dept_id from public.crm_departments where tenant_id = org.id and key = funcs[i][3] limit 1;

      insert into public.crm_business_functions
        (tenant_id, department_id, key, name, function_group, dashboard_profile_key, automation_profile_key, is_sales_related, is_system)
      values
        (org.id, dept_id, funcs[i][1], funcs[i][2], funcs[i][4], funcs[i][5], funcs[i][6], funcs[i][7]::boolean, true)
      on conflict (tenant_id, key) do update
        set department_id = excluded.department_id,
            name = excluded.name,
            function_group = excluded.function_group,
            dashboard_profile_key = excluded.dashboard_profile_key,
            automation_profile_key = excluded.automation_profile_key,
            is_sales_related = excluded.is_sales_related,
            is_system = true;
    end loop;

    -- Feature flags (todas desligadas)
    insert into public.crm_feature_flags (tenant_id, key, name, description, enabled, config)
    values (
      org.id,
      'dynamic_user_context_enabled',
      'Contexto dinâmico de usuários',
      'Ativa a nova lógica de permissões, áreas, funções, dashboards dinâmicos e automações por função.',
      false,
      '{"rollout":"disabled","fallback_to_legacy":true,"created_by_sprint":"user_context_sprint_1","notes":"Sprint 1 cria apenas a fundação. Não ativar em produção ainda."}'::jsonb
    )
    on conflict (tenant_id, key) do update
      set name = excluded.name,
          description = excluded.description;

    insert into public.crm_feature_flags (tenant_id, key, name, description, enabled, config)
    values (
      org.id,
      'dynamic_dashboards_enabled',
      'Dashboards dinâmicos por função',
      'Ativa o carregamento de dashboards por permissão, área e função.',
      false,
      '{"rollout":"disabled","fallback_to_legacy_dashboard":true}'::jsonb
    )
    on conflict (tenant_id, key) do update
      set name = excluded.name,
          description = excluded.description;

    insert into public.crm_feature_flags (tenant_id, key, name, description, enabled, config)
    values (
      org.id,
      'function_automations_enabled',
      'Automações por função',
      'Ativa regras de automação específicas por função do usuário.',
      false,
      '{"rollout":"disabled","dry_run":true,"execute_real_actions":false}'::jsonb
    )
    on conflict (tenant_id, key) do update
      set name = excluded.name,
          description = excluded.description;
  end loop;
end $$;

-- ============================================================
-- 9. VIEW DE LEITURA FUTURA (sem security definer; respeita RLS das base tables)
-- ============================================================

create or replace view public.crm_user_context_view as
select
  uc.id,
  uc.tenant_id,
  uc.user_id,
  uc.status,
  uc.legacy_user_type,
  uc.legacy_commercial_function,
  uc.is_dashboard_dynamic_enabled,
  uc.is_automation_dynamic_enabled,
  pr.key as permission_key,
  pr.name as permission_name,
  pr.level as permission_level,
  d.key as department_key,
  d.name as department_name,
  bf.key as business_function_key,
  bf.name as business_function_name,
  bf.function_group,
  bf.is_sales_related,
  bf.dashboard_profile_key,
  bf.automation_profile_key,
  uc.manager_user_id,
  uc.metadata,
  uc.created_at,
  uc.updated_at
from public.crm_user_contexts uc
left join public.crm_permission_roles pr on pr.id = uc.permission_role_id and pr.tenant_id = uc.tenant_id
left join public.crm_departments d on d.id = uc.department_id and d.tenant_id = uc.tenant_id
left join public.crm_business_functions bf on bf.id = uc.business_function_id and bf.tenant_id = uc.tenant_id;