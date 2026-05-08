-- INV 1.2 step 1: extend inventory_item_status enum with operational physical states.
ALTER TYPE public.inventory_item_status ADD VALUE IF NOT EXISTS 'reserved';
ALTER TYPE public.inventory_item_status ADD VALUE IF NOT EXISTS 'in_preparation';
ALTER TYPE public.inventory_item_status ADD VALUE IF NOT EXISTS 'dispatched';
ALTER TYPE public.inventory_item_status ADD VALUE IF NOT EXISTS 'in_operation';
ALTER TYPE public.inventory_item_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE public.inventory_item_status ADD VALUE IF NOT EXISTS 'inactive';