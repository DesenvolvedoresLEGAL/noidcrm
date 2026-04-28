-- Bulk update for prospect priority scores (used by rescore-prospects)
create or replace function public.bulk_update_prospect_priority(
  p_updates jsonb
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with payload as (
    select
      (x->>'id')::uuid as id,
      (x->>'score')::numeric as score
    from jsonb_array_elements(p_updates) x
  )
  update public.prospects p
  set priority_score = payload.score
  from payload
  where p.id = payload.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.bulk_update_prospect_priority(jsonb) from public;
grant execute on function public.bulk_update_prospect_priority(jsonb) to service_role;

-- Index to speed up rescore status lookups in system_events
create index if not exists idx_system_events_entity_event_created
  on public.system_events (entity_id, event_type, created_at desc);