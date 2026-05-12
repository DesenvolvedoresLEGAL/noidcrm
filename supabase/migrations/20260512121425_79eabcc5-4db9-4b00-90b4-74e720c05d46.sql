-- 1) Enum dedicado para modo de controle de categoria
do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_category_control_mode') then
    create type public.inventory_category_control_mode as enum ('serialized','quantity','mixed');
  end if;
end$$;

-- 2) Categoria: control_mode
alter table public.inventory_categories
  add column if not exists control_mode public.inventory_category_control_mode
    not null default 'serialized';

update public.inventory_categories
set control_mode = item_kind::text::public.inventory_category_control_mode
where control_mode is distinct from item_kind::text::public.inventory_category_control_mode;

-- 3) Família: item_kind
alter table public.inventory_families
  add column if not exists item_kind public.inventory_item_kind not null default 'serialized';

update public.inventory_families f
set item_kind = case
  when c.item_kind = 'quantity' then 'quantity'::public.inventory_item_kind
  else 'serialized'::public.inventory_item_kind
end
from public.inventory_categories c
where f.category_id = c.id;

-- 4) Trigger de coerência família x categoria
create or replace function public.enforce_family_kind_matches_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_mode public.inventory_category_control_mode;
begin
  select control_mode into v_mode
  from public.inventory_categories
  where id = new.category_id;

  if v_mode is null then
    return new;
  end if;

  if v_mode = 'serialized' and new.item_kind <> 'serialized' then
    raise exception 'O tipo padrão desta família precisa respeitar o modo de controle permitido da categoria.';
  end if;

  if v_mode = 'quantity' and new.item_kind <> 'quantity' then
    raise exception 'O tipo padrão desta família precisa respeitar o modo de controle permitido da categoria.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_enforce_family_kind_matches_category on public.inventory_families;
create trigger trg_enforce_family_kind_matches_category
before insert or update of category_id, item_kind on public.inventory_families
for each row execute function public.enforce_family_kind_matches_category();