
drop function if exists public.mark_contact_phone_invalid(uuid, text) cascade;
drop function if exists public.recompute_primary_contact(uuid) cascade;

create function public.recompute_primary_contact(p_prospect_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_new_primary uuid;
  v_old_primary uuid;
  v_org uuid;
begin
  select organization_id into v_org from public.prospects where id = p_prospect_id;

  select id into v_old_primary from public.enriched_contact_profiles
  where prospect_id = p_prospect_id and is_primary = true limit 1;

  select id into v_new_primary from public.enriched_contact_profiles
  where prospect_id = p_prospect_id
    and coalesce(is_merged, false) = false
  order by
    case phone_match_quality
      when 'person_whatsapp' then 1
      when 'person_mobile' then 2
      when 'person_direct' then 3
      when 'company_reception' then 8
      when 'company_main' then 9
      else 5
    end asc,
    coalesce(phone_confidence, 0) desc,
    coalesce(confidence_score, 0) desc,
    case seniority
      when 'c_level' then 1 when 'vp' then 2 when 'director' then 3
      when 'manager' then 4 else 5
    end asc,
    (linkedin_url is not null) desc,
    created_at asc
  limit 1;

  if v_new_primary is null then return null; end if;

  if v_new_primary <> coalesce(v_old_primary, '00000000-0000-0000-0000-000000000000'::uuid) then
    update public.enriched_contact_profiles set is_primary = false
      where prospect_id = p_prospect_id and id <> v_new_primary and is_primary = true;
    update public.enriched_contact_profiles set is_primary = true
      where id = v_new_primary;
    if v_org is not null then
      insert into public.revenue_events (organization_id, event_type, payload, prospect_id, contact_id)
      values (v_org, 'primary_contact_recomputed', jsonb_build_object(
        'prospect_id', p_prospect_id,
        'old_primary', v_old_primary,
        'new_primary', v_new_primary
      ), p_prospect_id, v_new_primary);
    end if;
  end if;

  return v_new_primary;
end;
$fn$;

grant execute on function public.recompute_primary_contact(uuid) to authenticated, service_role;

create function public.mark_contact_phone_invalid(
  p_contact_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid;
  v_prospect uuid;
begin
  select p.organization_id, e.prospect_id
    into v_org, v_prospect
  from public.enriched_contact_profiles e
  join public.prospects p on p.id = e.prospect_id
  where e.id = p_contact_id;

  if v_org is null then
    return jsonb_build_object('success', false, 'error', 'contact_not_found');
  end if;

  if not exists (
    select 1 from public.organization_members
    where user_id = auth.uid() and organization_id = v_org
  ) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  update public.enriched_contact_profiles set
    phone_validation_status = 'invalid',
    phone_revealed = false,
    is_whatsapp_ready = false,
    phone_quality_reason = coalesce(p_reason, 'marked_invalid_by_user'),
    phone_last_validation_at = now()
  where id = p_contact_id;

  insert into public.revenue_events (organization_id, event_type, payload, prospect_id, contact_id)
  values (v_org, 'phone_marked_invalid', jsonb_build_object(
    'contact_id', p_contact_id, 'prospect_id', v_prospect,
    'reason', p_reason, 'by', auth.uid()
  ), v_prospect, p_contact_id);

  perform public.recompute_primary_contact(v_prospect);
  return jsonb_build_object('success', true);
end;
$fn$;

grant execute on function public.mark_contact_phone_invalid(uuid, text) to authenticated;

create or replace function public.trg_recompute_primary_on_phone_change()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (new.phone_revealed is distinct from old.phone_revealed)
     or (new.phone_match_quality is distinct from old.phone_match_quality)
     or (new.phone_confidence is distinct from old.phone_confidence)
     or (new.is_whatsapp_ready is distinct from old.is_whatsapp_ready) then
    perform public.recompute_primary_contact(new.prospect_id);
  end if;
  return new;
end;
$fn$;

drop trigger if exists enriched_contact_profiles_recompute_primary on public.enriched_contact_profiles;
create trigger enriched_contact_profiles_recompute_primary
after update on public.enriched_contact_profiles
for each row execute function public.trg_recompute_primary_on_phone_change();

with dups as (
  select prospect_id, phone, count(*) as c
  from public.enriched_contact_profiles
  where phone is not null and phone_revealed = true
  group by 1,2 having count(*) > 1
)
update public.enriched_contact_profiles e set
  phone_match_quality = 'company_main',
  phone_confidence = 10,
  phone_revealed = false,
  is_whatsapp_ready = false,
  phone_reveal_status = 'rejected_company_phone',
  phone_validation_status = 'invalid',
  phone_quality_reason = 'suspected_shared_company_phone',
  phone_last_validation_at = now()
from dups d
where e.prospect_id = d.prospect_id
  and e.phone = d.phone;

update public.enriched_contact_profiles set
  phone_match_quality = 'unknown',
  phone_confidence = 50,
  phone_validation_status = 'unknown',
  phone_quality_reason = coalesce(phone_quality_reason, 'legacy_unclassified')
where phone_revealed = true
  and phone is not null
  and phone_match_quality is null;
