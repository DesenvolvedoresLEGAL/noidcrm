-- ============================================================
-- SPRINT 2 — Infra de backfill (sem alterar dados ainda)
-- ============================================================

-- 1. Tabela de logs
create table if not exists public.crm_user_context_backfill_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  organization_member_id uuid,
  action text not null,
  status text not null,
  legacy_org_role text,
  legacy_user_type text,
  legacy_commercial_function text,
  mapped_permission_key text,
  mapped_department_key text,
  mapped_business_function_key text,
  mapping_confidence text,
  requires_review boolean not null default false,
  review_reason text,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_user_context_backfill_logs_tenant_action
  on public.crm_user_context_backfill_logs (tenant_id, action, status);
create index if not exists idx_crm_user_context_backfill_logs_tenant_user
  on public.crm_user_context_backfill_logs (tenant_id, user_id);

alter table public.crm_user_context_backfill_logs enable row level security;

drop policy if exists "admins and owners can read crm backfill logs" on public.crm_user_context_backfill_logs;
create policy "admins and owners can read crm backfill logs"
  on public.crm_user_context_backfill_logs
  for select
  using (public.is_tenant_admin_or_owner(tenant_id));

drop policy if exists "admins and owners can manage crm backfill logs" on public.crm_user_context_backfill_logs;
create policy "admins and owners can manage crm backfill logs"
  on public.crm_user_context_backfill_logs
  for all
  using (public.is_tenant_admin_or_owner(tenant_id))
  with check (public.is_tenant_admin_or_owner(tenant_id));

-- ============================================================
-- 2. Função de mapeamento determinístico
-- ============================================================

create or replace function public.crm_resolve_user_context_mapping(
  _org_role text,
  _user_app_role text
)
returns table (
  permission_key text,
  department_key text,
  business_function_key text,
  mapping_confidence text,
  requires_review boolean,
  review_reason text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_org text := lower(coalesce(_org_role, ''));
  v_app text := lower(coalesce(_user_app_role, ''));
  v_perm text;
  v_dept text;
  v_func text;
  v_conf text := 'medium';
  v_rev boolean := false;
  v_reason text;
begin
  -- ---- PERMISSÃO ----
  if v_org = 'owner' then
    v_perm := 'owner';
  elsif v_org = 'admin' or v_app = 'admin' then
    v_perm := 'admin';
  elsif v_org = 'manager' or v_app = 'manager' then
    v_perm := 'manager';
  elsif v_org = 'viewer' then
    v_perm := 'viewer';
  elsif v_org in ('sales','cs','finance','operations') then
    v_perm := 'user';
  else
    v_perm := 'user';
    v_rev := true;
    v_reason := 'Permissão mapeada por fallback (org_role desconhecido).';
  end if;

  -- ---- ÁREA / FUNÇÃO ----
  if v_perm = 'owner' then
    v_dept := 'executive';
    v_func := 'owner';
    v_conf := 'high';
  elsif v_org = 'sales' then
    v_dept := 'sales';
    v_func := 'closer';
    v_rev := true;
    v_reason := coalesce(v_reason, 'Vendedor sem função comercial explícita. Mapeado temporariamente para sales/closer.');
  elsif v_org = 'cs' then
    v_dept := 'customer_success';
    v_func := 'cs';
  elsif v_org = 'finance' then
    v_dept := 'finance';
    v_func := 'finance_admin';
  elsif v_org = 'operations' then
    v_dept := 'operations';
    v_func := 'operations';
  elsif v_org = 'viewer' then
    v_dept := 'executive';
    v_func := 'viewer';
  elsif v_perm = 'manager' then
    v_dept := 'sales';
    v_func := 'director';
    v_rev := true;
    v_reason := coalesce(v_reason, 'Manager sem área legada explícita. Mapeado temporariamente para sales/director.');
  elsif v_perm = 'admin' then
    v_dept := 'operations';
    v_func := 'operations';
    v_rev := true;
    v_reason := coalesce(v_reason, 'Admin sem área/função legada explícita. Mapeado temporariamente para operations/operations.');
  else
    v_dept := null;
    v_func := null;
    v_conf := 'low';
    v_rev := true;
    v_reason := coalesce(v_reason, 'Área e função não identificadas no backfill.');
  end if;

  return query select v_perm, v_dept, v_func, v_conf, v_rev, v_reason;
end;
$$;

-- ============================================================
-- 3. View de DRY RUN
-- ============================================================

create or replace view public.crm_user_context_backfill_preview as
with member_app_role as (
  -- Pega o "melhor" app_role do usuário (admin > manager > sales/cs)
  select
    user_id,
    case
      when bool_or(role::text = 'admin') then 'admin'
      when bool_or(role::text = 'manager') then 'manager'
      when bool_or(role::text = 'sales') then 'sales'
      when bool_or(role::text = 'cs') then 'cs'
      else null
    end as best_app_role
  from public.user_roles
  group by user_id
),
base as (
  select
    om.organization_id as tenant_id,
    om.id as organization_member_id,
    om.user_id,
    om.org_role::text as legacy_org_role,
    coalesce(mar.best_app_role, '') as legacy_user_type,
    om.status as legacy_status,
    case
      when om.deleted_at is not null then 'inactive'
      when lower(coalesce(om.status,'active')) in ('active','ativo') then 'active'
      when lower(coalesce(om.status,'')) in ('pending','pendente','invited','convite') then 'pending'
      when lower(coalesce(om.status,'')) in ('blocked','bloqueado','suspended','suspenso') then 'blocked'
      when lower(coalesce(om.status,'')) in ('inactive','inativo','disabled','desativado') then 'inactive'
      else 'active'
    end as mapped_status,
    om.deleted_at
  from public.organization_members om
  left join member_app_role mar on mar.user_id = om.user_id
  where om.user_id is not null
    and om.organization_id is not null
)
select
  b.tenant_id,
  b.organization_member_id,
  b.user_id,
  b.legacy_org_role,
  b.legacy_user_type,
  b.legacy_status,
  b.mapped_status,
  b.deleted_at,
  m.permission_key as mapped_permission_key,
  m.department_key as mapped_department_key,
  m.business_function_key as mapped_business_function_key,
  m.mapping_confidence,
  m.requires_review,
  m.review_reason,
  case
    when b.deleted_at is not null then 'would_skip_deleted'
    when exists (
      select 1 from public.crm_user_contexts uc
      where uc.tenant_id = b.tenant_id and uc.user_id = b.user_id
    ) then 'would_update_or_preserve'
    else 'would_create'
  end as action
from base b
cross join lateral public.crm_resolve_user_context_mapping(b.legacy_org_role, b.legacy_user_type) m;

-- ============================================================
-- 4. Função de execução do backfill (chamada manual após dry run validado)
-- ============================================================

create or replace function public.crm_run_user_context_backfill()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_perm_id uuid;
  v_dept_id uuid;
  v_func_id uuid;
  v_existing record;
  v_action text;
  v_log_status text;
  v_metadata jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_preserved int := 0;
  v_skipped_deleted int := 0;
  v_errors int := 0;
  v_total_processed int := 0;
begin
  -- Log dos deletados (skipped_deleted_member)
  for r in
    select id as organization_member_id, organization_id as tenant_id, user_id, org_role::text as legacy_org_role
    from public.organization_members
    where deleted_at is not null
      and organization_id is not null
  loop
    insert into public.crm_user_context_backfill_logs
      (tenant_id, user_id, organization_member_id, action, status, legacy_org_role, metadata)
    values
      (r.tenant_id, r.user_id, r.organization_member_id, 'skipped_deleted_member', 'skipped',
       r.legacy_org_role,
       jsonb_build_object('created_by_sprint','user_context_sprint_2','reason','member soft-deleted'));
    v_skipped_deleted := v_skipped_deleted + 1;
  end loop;

  -- Backfill principal
  for r in
    select * from public.crm_user_context_backfill_preview
    where deleted_at is null
  loop
    v_total_processed := v_total_processed + 1;

    begin
      -- Resolver IDs
      select id into v_perm_id
      from public.crm_permission_roles
      where tenant_id = r.tenant_id and key = r.mapped_permission_key
      limit 1;

      v_dept_id := null;
      v_func_id := null;
      if r.mapped_department_key is not null then
        select id into v_dept_id
        from public.crm_departments
        where tenant_id = r.tenant_id and key = r.mapped_department_key
        limit 1;
      end if;
      if r.mapped_business_function_key is not null then
        select id into v_func_id
        from public.crm_business_functions
        where tenant_id = r.tenant_id and key = r.mapped_business_function_key
        limit 1;
      end if;

      if v_perm_id is null then
        insert into public.crm_user_context_backfill_logs
          (tenant_id, user_id, organization_member_id, action, status,
           legacy_org_role, legacy_user_type, mapped_permission_key, mapped_department_key,
           mapped_business_function_key, mapping_confidence, requires_review, review_reason,
           error_message, metadata)
        values
          (r.tenant_id, r.user_id, r.organization_member_id, 'error', 'error',
           r.legacy_org_role, r.legacy_user_type, r.mapped_permission_key, r.mapped_department_key,
           r.mapped_business_function_key, r.mapping_confidence, r.requires_review, r.review_reason,
           'permission_role_id não resolvido para key=' || coalesce(r.mapped_permission_key,'null'),
           jsonb_build_object('created_by_sprint','user_context_sprint_2'));
        v_errors := v_errors + 1;
        continue;
      end if;

      v_metadata := jsonb_build_object(
        'created_by_sprint', 'user_context_sprint_2',
        'backfill_version', '2026_04_user_context_v1',
        'mapping_source', 'organization_members+user_roles',
        'mapping_confidence', r.mapping_confidence,
        'requires_review', r.requires_review,
        'review_reason', coalesce(r.review_reason, ''),
        'legacy', jsonb_build_object(
          'org_role', coalesce(r.legacy_org_role,''),
          'user_type', coalesce(r.legacy_user_type,''),
          'commercial_function', ''
        )
      );

      -- Existe?
      select * into v_existing
      from public.crm_user_contexts
      where tenant_id = r.tenant_id and user_id = r.user_id
      limit 1;

      if v_existing.id is null then
        -- INSERT
        insert into public.crm_user_contexts
          (tenant_id, user_id, permission_role_id, department_id, business_function_id,
           legacy_user_type, legacy_commercial_function, status,
           is_dashboard_dynamic_enabled, is_automation_dynamic_enabled, metadata)
        values
          (r.tenant_id, r.user_id, v_perm_id, v_dept_id, v_func_id,
           nullif(r.legacy_user_type, ''), null, r.mapped_status,
           false, false, v_metadata);
        v_action := 'created_context';
        v_log_status := 'success';
        v_created := v_created + 1;
      else
        -- UPDATE: só preenche nulos OU se foi criado por esta sprint
        if (v_existing.metadata ->> 'created_by_sprint') = 'user_context_sprint_2' then
          -- Atualização permitida em campos nulos + atualiza metadata
          update public.crm_user_contexts
          set
            permission_role_id = coalesce(permission_role_id, v_perm_id),
            department_id = coalesce(department_id, v_dept_id),
            business_function_id = coalesce(business_function_id, v_func_id),
            legacy_user_type = coalesce(legacy_user_type, nullif(r.legacy_user_type,'')),
            status = case when status is null then r.mapped_status else status end,
            metadata = v_metadata
          where id = v_existing.id;
          v_action := 'updated_context';
          v_log_status := 'success';
          v_updated := v_updated + 1;
        else
          -- Preserva tudo: só preenche os campos nulos sem tocar metadata existente
          update public.crm_user_contexts
          set
            permission_role_id = coalesce(permission_role_id, v_perm_id),
            department_id = coalesce(department_id, v_dept_id),
            business_function_id = coalesce(business_function_id, v_func_id),
            legacy_user_type = coalesce(legacy_user_type, nullif(r.legacy_user_type,''))
          where id = v_existing.id;
          v_action := 'updated_context';
          v_log_status := 'preserved_existing';
          v_preserved := v_preserved + 1;
        end if;
      end if;

      insert into public.crm_user_context_backfill_logs
        (tenant_id, user_id, organization_member_id, action, status,
         legacy_org_role, legacy_user_type, mapped_permission_key, mapped_department_key,
         mapped_business_function_key, mapping_confidence, requires_review, review_reason, metadata)
      values
        (r.tenant_id, r.user_id, r.organization_member_id, v_action, v_log_status,
         r.legacy_org_role, r.legacy_user_type, r.mapped_permission_key, r.mapped_department_key,
         r.mapped_business_function_key, r.mapping_confidence, r.requires_review, r.review_reason,
         jsonb_build_object('created_by_sprint','user_context_sprint_2'));

    exception when others then
      insert into public.crm_user_context_backfill_logs
        (tenant_id, user_id, organization_member_id, action, status,
         legacy_org_role, legacy_user_type, error_message, metadata)
      values
        (r.tenant_id, r.user_id, r.organization_member_id, 'error', 'error',
         r.legacy_org_role, r.legacy_user_type, sqlerrm,
         jsonb_build_object('created_by_sprint','user_context_sprint_2'));
      v_errors := v_errors + 1;
    end;
  end loop;

  return jsonb_build_object(
    'total_processed', v_total_processed,
    'created', v_created,
    'updated', v_updated,
    'preserved', v_preserved,
    'skipped_deleted', v_skipped_deleted,
    'errors', v_errors
  );
end;
$$;

revoke execute on function public.crm_run_user_context_backfill() from public, anon, authenticated;