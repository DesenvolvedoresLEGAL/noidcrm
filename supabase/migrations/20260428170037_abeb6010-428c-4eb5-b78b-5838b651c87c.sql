-- Sprint 6.4: Runtime logs for dynamic Closer dashboard substitution

create table if not exists public.crm_dynamic_dashboard_runtime_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  profile_key text,
  event_type text not null,
  guard_allowed boolean not null default false,
  fallback_used boolean not null default false,
  fallback_reason text,
  load_ms int,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_dynamic_dashboard_runtime_logs_event_type_valid check (
    event_type in (
      'runtime_allowed',
      'runtime_fallback',
      'runtime_error',
      'user_chose_legacy_dashboard',
      'user_returned_to_dynamic_dashboard'
    )
  )
);

create index if not exists idx_crm_dyn_dash_runtime_logs_tenant_user_created
  on public.crm_dynamic_dashboard_runtime_logs (tenant_id, user_id, created_at desc);

create index if not exists idx_crm_dyn_dash_runtime_logs_tenant_event_created
  on public.crm_dynamic_dashboard_runtime_logs (tenant_id, event_type, created_at desc);

alter table public.crm_dynamic_dashboard_runtime_logs enable row level security;

drop policy if exists "admins and owners can read dynamic dashboard runtime logs"
  on public.crm_dynamic_dashboard_runtime_logs;

create policy "admins and owners can read dynamic dashboard runtime logs"
  on public.crm_dynamic_dashboard_runtime_logs
  for select
  using (public.is_tenant_admin_or_owner(tenant_id));

-- RPC: log a runtime event safely
create or replace function public.crm_log_dynamic_dashboard_runtime_event(
  p_tenant_id uuid,
  p_user_id uuid,
  p_profile_key text default null,
  p_event_type text default null,
  p_guard_allowed boolean default false,
  p_fallback_used boolean default false,
  p_fallback_reason text default null,
  p_load_ms int default null,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_in_tenant boolean := false;
  v_target_in_tenant boolean := false;
  v_is_admin boolean := false;
  v_safe_error text;
  v_id uuid;
begin
  if v_caller is null then
    raise exception 'unauthenticated';
  end if;

  if p_tenant_id is null or p_user_id is null or p_event_type is null then
    raise exception 'invalid_arguments';
  end if;

  -- Caller must belong to the tenant
  select exists(
    select 1 from public.crm_user_context_view
    where tenant_id = p_tenant_id and user_id = v_caller
  ) into v_caller_in_tenant;

  if not v_caller_in_tenant then
    raise exception 'caller_not_in_tenant';
  end if;

  -- Target must belong to the tenant
  select exists(
    select 1 from public.crm_user_context_view
    where tenant_id = p_tenant_id and user_id = p_user_id
  ) into v_target_in_tenant;

  if not v_target_in_tenant then
    raise exception 'target_not_in_tenant';
  end if;

  v_is_admin := public.is_tenant_admin_or_owner(p_tenant_id);

  -- Self-events allowed; admin/owner can log on behalf of anyone in tenant
  if v_caller <> p_user_id and not v_is_admin then
    raise exception 'forbidden';
  end if;

  v_safe_error := case
    when p_error_message is null then null
    else left(p_error_message, 500)
  end;

  insert into public.crm_dynamic_dashboard_runtime_logs (
    tenant_id, user_id, profile_key, event_type,
    guard_allowed, fallback_used, fallback_reason,
    load_ms, error_message, metadata
  ) values (
    p_tenant_id, p_user_id, p_profile_key, p_event_type,
    coalesce(p_guard_allowed, false),
    coalesce(p_fallback_used, false),
    p_fallback_reason,
    p_load_ms,
    v_safe_error,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

revoke all on function public.crm_log_dynamic_dashboard_runtime_event(
  uuid, uuid, text, text, boolean, boolean, text, int, text, jsonb
) from public;

grant execute on function public.crm_log_dynamic_dashboard_runtime_event(
  uuid, uuid, text, text, boolean, boolean, text, int, text, jsonb
) to authenticated;