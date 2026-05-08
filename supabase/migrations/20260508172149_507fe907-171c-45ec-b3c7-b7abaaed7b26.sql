-- Sprint INV 0.8: Categorias, Famílias, Classificação Operacional

create extension if not exists unaccent;

create or replace function public.normalize_inventory_slug(input text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if input is null then return null; end if;
  return lower(
    regexp_replace(
      regexp_replace(
        unaccent(trim(input)),
        '[^a-zA-Z0-9]+', '_', 'g'
      ),
      '^_+|_+$', '', 'g'
    )
  );
end;
$$;

alter table public.inventory_categories
  add column if not exists slug text,
  add column if not exists color text,
  add column if not exists icon text;

update public.inventory_categories
set slug = public.normalize_inventory_slug(name)
where slug is null or trim(slug) = '';

do $$
declare
  r record; base_slug text; candidate text; i int;
begin
  for r in
    select id, organization_id, slug
    from (
      select id, organization_id, slug,
             row_number() over (partition by organization_id, slug order by created_at) as rn
      from public.inventory_categories
    ) s
    where rn > 1
  loop
    base_slug := r.slug; i := 2;
    loop
      candidate := base_slug || '_' || i;
      exit when not exists (
        select 1 from public.inventory_categories
        where organization_id = r.organization_id and slug = candidate
      );
      i := i + 1;
    end loop;
    update public.inventory_categories set slug = candidate where id = r.id;
  end loop;
end $$;

alter table public.inventory_categories alter column slug set not null;

create unique index if not exists inventory_categories_org_slug_unique
  on public.inventory_categories (organization_id, slug);

create or replace function public.set_inventory_category_slug()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.normalize_inventory_slug(new.name);
  else
    new.slug := public.normalize_inventory_slug(new.slug);
  end if;
  return new;
end; $$;

drop trigger if exists trg_set_inventory_category_slug on public.inventory_categories;
create trigger trg_set_inventory_category_slug
before insert or update on public.inventory_categories
for each row execute function public.set_inventory_category_slug();

create table if not exists public.inventory_families (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.inventory_categories(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_families_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_families_slug_not_empty check (length(trim(slug)) > 0),
  constraint inventory_families_org_category_slug_unique unique (organization_id, category_id, slug)
);

create index if not exists idx_inventory_families_org_category_active
  on public.inventory_families (organization_id, category_id, is_active);

alter table public.inventory_families enable row level security;
drop policy if exists "inv_select" on public.inventory_families;
drop policy if exists "inv_insert" on public.inventory_families;
drop policy if exists "inv_update" on public.inventory_families;
create policy "inv_select" on public.inventory_families
  for select to authenticated using (user_can_access_inventory(organization_id));
create policy "inv_insert" on public.inventory_families
  for insert to authenticated with check (user_can_access_inventory(organization_id));
create policy "inv_update" on public.inventory_families
  for update to authenticated
  using (user_can_access_inventory(organization_id))
  with check (user_can_access_inventory(organization_id));

create or replace function public.set_inventory_family_slug()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.normalize_inventory_slug(new.name);
  else
    new.slug := public.normalize_inventory_slug(new.slug);
  end if;
  return new;
end; $$;

drop trigger if exists trg_set_inventory_family_slug on public.inventory_families;
create trigger trg_set_inventory_family_slug
before insert or update on public.inventory_families
for each row execute function public.set_inventory_family_slug();

drop trigger if exists trg_inventory_families_updated_at on public.inventory_families;
create trigger trg_inventory_families_updated_at
before update on public.inventory_families
for each row execute function public.update_updated_at_column();

alter table public.inventory_items
  add column if not exists family_id uuid references public.inventory_families(id) on delete set null,
  add column if not exists operational_type text not null default 'equipment',
  add column if not exists criticality text not null default 'medium';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_items_operational_type_check') then
    alter table public.inventory_items
      add constraint inventory_items_operational_type_check
      check (operational_type in ('equipment','accessory','part','consumable','logical_kit','infrastructure','tool','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_items_criticality_check') then
    alter table public.inventory_items
      add constraint inventory_items_criticality_check
      check (criticality in ('low','medium','high','critical'));
  end if;
end $$;

create index if not exists idx_inventory_items_family
  on public.inventory_items (organization_id, family_id);
create index if not exists idx_inventory_items_criticality
  on public.inventory_items (organization_id, criticality);

create or replace function public.validate_inventory_item_family_category()
returns trigger language plpgsql set search_path = public as $$
declare family_org_id uuid; family_category_id uuid;
begin
  if new.family_id is not null then
    select organization_id, category_id
    into family_org_id, family_category_id
    from public.inventory_families where id = new.family_id;
    if family_category_id is null then
      raise exception 'Família de inventário inválida.';
    end if;
    if family_org_id <> new.organization_id then
      raise exception 'Família pertence a outra organização.';
    end if;
    if new.category_id is null or new.category_id <> family_category_id then
      raise exception 'A família selecionada não pertence à categoria informada.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_validate_inventory_item_family_category on public.inventory_items;
create trigger trg_validate_inventory_item_family_category
before insert or update of category_id, family_id, organization_id
on public.inventory_items
for each row execute function public.validate_inventory_item_family_category();

create or replace function public.get_inventory_category_overview(p_org_id uuid)
returns table (
  category_id uuid,
  category_name text,
  category_slug text,
  category_color text,
  category_icon text,
  total_skus bigint,
  total_units numeric,
  available_units numeric,
  reserved_units numeric,
  maintenance_units numeric,
  critical_items bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select 1 where public.user_can_access_inventory(p_org_id)
  ),
  agg as (
    select
      i.category_id,
      count(*)::bigint as skus,
      coalesce(sum(i.quantity_total), 0)::numeric as total_units,
      coalesce(sum(i.quantity_available), 0)::numeric as available_units,
      0::numeric as reserved_units,
      count(*) filter (where i.status = 'maintenance')::numeric as maintenance_units,
      count(*) filter (where i.criticality = 'critical')::bigint as critical_items
    from public.inventory_items i
    where i.organization_id = p_org_id
      and exists (select 1 from allowed)
    group by i.category_id
  )
  select
    c.id, c.name, c.slug, c.color, c.icon,
    coalesce(a.skus, 0)::bigint,
    coalesce(a.total_units, 0)::numeric,
    coalesce(a.available_units, 0)::numeric,
    coalesce(a.reserved_units, 0)::numeric,
    coalesce(a.maintenance_units, 0)::numeric,
    coalesce(a.critical_items, 0)::bigint
  from public.inventory_categories c
  left join agg a on a.category_id = c.id
  where c.organization_id = p_org_id
    and c.is_active = true
    and exists (select 1 from allowed)
  order by c.sort_order asc nulls last, c.name asc;
$$;

revoke all on function public.get_inventory_category_overview(uuid) from public;
grant execute on function public.get_inventory_category_overview(uuid) to authenticated;