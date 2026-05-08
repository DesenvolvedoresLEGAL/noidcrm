-- Sprint PRICE 1.1: proposal_payment_intents + proposal_payment_events + proposal payment fields + RPCs

-- ============= TABLE: proposal_payment_intents =============
create table if not exists public.proposal_payment_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null,
  dynamic_pricing_rule_id uuid references public.proposal_dynamic_pricing_rules(id) on delete set null,
  dynamic_pricing_tier_id uuid references public.proposal_dynamic_pricing_tiers(id) on delete set null,
  source text not null default 'proposal_link',
  expected_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  difference_amount numeric not null default 0,
  currency text not null default 'BRL',
  status text not null default 'pending',
  payment_method text not null default 'pix',
  erp_invoice_id uuid,
  erp_charge_id uuid,
  pix_qr_code text,
  pix_copy_paste text,
  expires_at timestamptz,
  paid_at timestamptz,
  dynamic_pricing_snapshot jsonb not null default '{}'::jsonb,
  payment_gateway_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  parent_payment_intent_id uuid references public.proposal_payment_intents(id) on delete set null,
  payment_reference text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposal_payment_intents_source_check
    check (source in ('proposal_link','crm_manual','erp_manual','complementary_charge','agent')),
  constraint proposal_payment_intents_status_check
    check (status in ('pending','paid_exact','paid_partial','paid_over','expired','cancelled','complementary_pending','complementary_paid','manual_review')),
  constraint proposal_payment_intents_method_check
    check (payment_method in ('pix','bank_transfer','boleto','credit_card','manual')),
  constraint proposal_payment_intents_amount_check
    check (expected_amount >= 0 and paid_amount >= 0 and difference_amount >= 0)
);

create index if not exists idx_ppi_proposal on public.proposal_payment_intents(proposal_id);
create index if not exists idx_ppi_org_status on public.proposal_payment_intents(organization_id, status);
create index if not exists idx_ppi_expires on public.proposal_payment_intents(expires_at) where status = 'pending';

-- ============= TABLE: proposal_payment_events =============
create table if not exists public.proposal_payment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null,
  payment_intent_id uuid references public.proposal_payment_intents(id) on delete set null,
  event_type text not null,
  expected_amount numeric,
  paid_amount numeric,
  difference_amount numeric,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint proposal_payment_events_type_check
    check (event_type in (
      'payment_intent_created','pix_generated','payment_received','payment_validated',
      'payment_partial','payment_overpaid','payment_exact','complementary_charge_created',
      'payment_expired','manual_review_required','cancelled'
    ))
);
create index if not exists idx_ppe_proposal on public.proposal_payment_events(proposal_id, created_at desc);
create index if not exists idx_ppe_intent on public.proposal_payment_events(payment_intent_id);

-- ============= ALTER proposals =============
alter table public.proposals
  add column if not exists payment_validation_status text,
  add column if not exists payment_expected_amount numeric,
  add column if not exists payment_paid_amount numeric,
  add column if not exists payment_difference_amount numeric,
  add column if not exists latest_payment_intent_id uuid,
  add column if not exists payment_snapshot jsonb not null default '{}'::jsonb;

-- ============= updated_at trigger =============
create trigger trg_ppi_updated_at
  before update on public.proposal_payment_intents
  for each row execute function public.update_updated_at_column();

-- ============= RLS =============
alter table public.proposal_payment_intents enable row level security;
alter table public.proposal_payment_events enable row level security;

create policy "ppi_select_org" on public.proposal_payment_intents
  for select using (organization_id = public.get_user_organization_id());

create policy "ppi_insert_org" on public.proposal_payment_intents
  for insert with check (organization_id = public.get_user_organization_id());

create policy "ppi_update_org" on public.proposal_payment_intents
  for update using (organization_id = public.get_user_organization_id());

create policy "ppi_delete_admin" on public.proposal_payment_intents
  for delete using (
    organization_id = public.get_user_organization_id()
    and (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'owner'::app_role))
  );

create policy "ppe_select_org" on public.proposal_payment_events
  for select using (organization_id = public.get_user_organization_id());

create policy "ppe_insert_org" on public.proposal_payment_events
  for insert with check (organization_id = public.get_user_organization_id());

-- ============= RPC 1: create_proposal_payment_intent =============
create or replace function public.create_proposal_payment_intent(
  p_proposal_id uuid,
  p_source text default 'proposal_link'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_snapshot jsonb;
  v_status text;
  v_amount numeric;
  v_tier uuid;
  v_rule uuid;
  v_intent_id uuid;
  v_user uuid := auth.uid();
begin
  select organization_id into v_org from public.proposals where id = p_proposal_id;
  if v_org is null then
    raise exception 'Proposal not found';
  end if;

  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, now());
  v_status := coalesce(v_snapshot->>'status', 'disabled');

  if v_status in ('requires_requote','expired','disabled') then
    return jsonb_build_object(
      'ok', false,
      'status', v_status,
      'message', 'Pagamento bloqueado. Esta condição comercial exige nova cotação.'
    );
  end if;

  v_amount := coalesce((v_snapshot->>'current_amount')::numeric, 0);
  v_tier := nullif(v_snapshot->>'current_tier_id','')::uuid;
  v_rule := nullif(v_snapshot->>'pricing_rule_id','')::uuid;

  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Valor vigente indisponível');
  end if;

  insert into public.proposal_payment_intents(
    organization_id, proposal_id, dynamic_pricing_rule_id, dynamic_pricing_tier_id,
    source, expected_amount, currency, status, payment_method,
    dynamic_pricing_snapshot, created_by, updated_by, expires_at
  ) values (
    v_org, p_proposal_id, v_rule, v_tier,
    coalesce(p_source,'proposal_link'), v_amount, coalesce(v_snapshot->>'currency','BRL'),
    'pending', 'pix', v_snapshot, v_user, v_user,
    nullif(v_snapshot->>'current_ends_at','')::timestamptz
  ) returning id into v_intent_id;

  update public.proposals
  set latest_payment_intent_id = v_intent_id,
      payment_expected_amount = v_amount,
      payment_validation_status = coalesce(payment_validation_status,'pending'),
      payment_snapshot = jsonb_build_object(
        'intent_id', v_intent_id,
        'expected_amount', v_amount,
        'tier_id', v_tier,
        'created_at', now()
      )
  where id = p_proposal_id;

  insert into public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, message, created_by
  ) values (
    v_org, p_proposal_id, v_intent_id, 'payment_intent_created',
    v_amount, 'Intenção de pagamento criada pelo valor vigente', v_user
  );

  return jsonb_build_object(
    'ok', true,
    'payment_intent_id', v_intent_id,
    'proposal_id', p_proposal_id,
    'expected_amount', v_amount,
    'dynamic_pricing_tier_id', v_tier,
    'status', 'pending',
    'message', 'Cobrança gerada pelo valor vigente'
  );
end;
$$;

-- ============= RPC 2: validate_proposal_payment_amount =============
create or replace function public.validate_proposal_payment_amount(
  p_payment_intent_id uuid,
  p_paid_amount numeric,
  p_paid_at timestamptz default now(),
  p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_snapshot jsonb;
  v_due numeric;
  v_diff numeric;
  v_new_status text;
  v_event text;
  v_prop_status text;
  v_user uuid := auth.uid();
begin
  select * into v_intent from public.proposal_payment_intents where id = p_payment_intent_id;
  if v_intent.id is null then
    raise exception 'Payment intent not found';
  end if;

  v_snapshot := public.calculate_proposal_dynamic_price(v_intent.proposal_id, p_paid_at);
  v_due := coalesce((v_snapshot->>'current_amount')::numeric, v_intent.expected_amount);

  if p_paid_amount = v_due then
    v_new_status := 'paid_exact';
    v_event := 'payment_exact';
    v_prop_status := 'paid_exact';
    v_diff := 0;
  elsif p_paid_amount < v_due then
    v_new_status := 'paid_partial';
    v_event := 'payment_partial';
    v_prop_status := 'paid_partial';
    v_diff := v_due - p_paid_amount;
  else
    v_new_status := 'paid_over';
    v_event := 'payment_overpaid';
    v_prop_status := 'paid_over';
    v_diff := p_paid_amount - v_due;
  end if;

  update public.proposal_payment_intents
  set paid_amount = p_paid_amount,
      difference_amount = v_diff,
      status = v_new_status,
      paid_at = p_paid_at,
      payment_reference = coalesce(p_payment_reference, payment_reference),
      expected_amount = v_due,
      dynamic_pricing_snapshot = v_snapshot,
      updated_by = v_user
  where id = p_payment_intent_id;

  update public.proposals
  set payment_validation_status = case
        when v_new_status = 'paid_partial' then 'complementary_pending'
        else v_prop_status
      end,
      payment_expected_amount = v_due,
      payment_paid_amount = p_paid_amount,
      payment_difference_amount = v_diff,
      payment_snapshot = jsonb_build_object(
        'intent_id', p_payment_intent_id,
        'expected_amount', v_due,
        'paid_amount', p_paid_amount,
        'difference_amount', v_diff,
        'paid_at', p_paid_at,
        'status', v_new_status
      )
  where id = v_intent.proposal_id;

  insert into public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, paid_amount, difference_amount, message, created_by
  ) values (
    v_intent.organization_id, v_intent.proposal_id, p_payment_intent_id, v_event,
    v_due, p_paid_amount, v_diff,
    case
      when v_new_status = 'paid_exact' then 'Pagamento corresponde ao valor vigente'
      when v_new_status = 'paid_partial' then 'Pagamento parcial. Diferença pendente.'
      else 'Pagamento maior que o valor vigente.'
    end,
    v_user
  );

  return jsonb_build_object(
    'ok', true,
    'payment_intent_id', p_payment_intent_id,
    'expected_amount', v_due,
    'paid_amount', p_paid_amount,
    'difference_amount', v_diff,
    'status', v_new_status
  );
end;
$$;

-- ============= RPC 3: create_complementary_payment_intent =============
create or replace function public.create_complementary_payment_intent(
  p_original_payment_intent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig record;
  v_new_id uuid;
  v_user uuid := auth.uid();
begin
  select * into v_orig from public.proposal_payment_intents where id = p_original_payment_intent_id;
  if v_orig.id is null then
    raise exception 'Original payment intent not found';
  end if;

  if v_orig.difference_amount <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Sem diferença pendente');
  end if;

  insert into public.proposal_payment_intents(
    organization_id, proposal_id, dynamic_pricing_rule_id, dynamic_pricing_tier_id,
    source, expected_amount, currency, status, payment_method,
    dynamic_pricing_snapshot, parent_payment_intent_id,
    created_by, updated_by, notes
  ) values (
    v_orig.organization_id, v_orig.proposal_id, v_orig.dynamic_pricing_rule_id, v_orig.dynamic_pricing_tier_id,
    'complementary_charge', v_orig.difference_amount, v_orig.currency, 'pending', 'pix',
    v_orig.dynamic_pricing_snapshot, v_orig.id,
    v_user, v_user, 'Cobrança complementar referente à diferença pendente'
  ) returning id into v_new_id;

  update public.proposal_payment_intents
  set status = 'complementary_pending', updated_by = v_user
  where id = v_orig.id;

  insert into public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, message, created_by, metadata
  ) values (
    v_orig.organization_id, v_orig.proposal_id, v_new_id, 'complementary_charge_created',
    v_orig.difference_amount, 'Cobrança complementar criada', v_user,
    jsonb_build_object('original_intent_id', v_orig.id)
  );

  return jsonb_build_object(
    'ok', true,
    'complementary_payment_intent_id', v_new_id,
    'difference_amount', v_orig.difference_amount,
    'status', 'pending',
    'message', 'Cobrança complementar gerada'
  );
end;
$$;

-- ============= RPC 4: expire_old_payment_intents =============
create or replace function public.expire_old_payment_intents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id, organization_id, proposal_id
    from public.proposal_payment_intents
    where status = 'pending'
      and expires_at is not null
      and expires_at < now()
  loop
    update public.proposal_payment_intents
    set status = 'expired'
    where id = r.id;

    insert into public.proposal_payment_events(
      organization_id, proposal_id, payment_intent_id, event_type, message
    ) values (
      r.organization_id, r.proposal_id, r.id, 'payment_expired',
      'Cobrança expirada automaticamente'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.create_proposal_payment_intent(uuid, text) to authenticated, anon;
grant execute on function public.validate_proposal_payment_amount(uuid, numeric, timestamptz, text) to authenticated;
grant execute on function public.create_complementary_payment_intent(uuid) to authenticated;
grant execute on function public.expire_old_payment_intents() to authenticated;