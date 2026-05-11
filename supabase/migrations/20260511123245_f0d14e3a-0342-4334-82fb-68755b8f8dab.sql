ALTER TABLE public.inventory_pre_reservation_allocations
  ADD COLUMN IF NOT EXISTS custom_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inventory_pre_reservation_allocations.custom_config IS
  'Configuração personalizada da pré-alocação. Mesmo shape de inventory_reservation_allocations.custom_config.';