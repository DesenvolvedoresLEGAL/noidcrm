CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_asset_code
  ON public.inventory_items (organization_id, asset_code)
  WHERE asset_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_serial_number
  ON public.inventory_items (organization_id, serial_number)
  WHERE serial_number IS NOT NULL;