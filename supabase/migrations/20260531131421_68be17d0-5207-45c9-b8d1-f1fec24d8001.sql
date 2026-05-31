ALTER TABLE public.ote_sales_records
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS seller_user_id uuid,
  ADD COLUMN IF NOT EXISTS seller_name_snapshot text,
  ADD COLUMN IF NOT EXISTS seller_role_snapshot text,
  ADD COLUMN IF NOT EXISTS seller_level_snapshot text,
  ADD COLUMN IF NOT EXISTS pre_sales_user_id uuid,
  ADD COLUMN IF NOT EXISTS pre_sales_name_snapshot text,
  ADD COLUMN IF NOT EXISTS pre_sales_role_snapshot text,
  ADD COLUMN IF NOT EXISTS pre_sales_level_snapshot text,
  ADD COLUMN IF NOT EXISTS attribution_source text,
  ADD COLUMN IF NOT EXISTS attribution_confidence text,
  ADD COLUMN IF NOT EXISTS commercial_commission_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eligible_ote_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualified_leads_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ote_sales_records_period
  ON public.ote_sales_records (organization_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_ote_sales_records_seller_period
  ON public.ote_sales_records (organization_id, seller_user_id, period_start, period_end)
  WHERE seller_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ote_sales_records_presales_period
  ON public.ote_sales_records (organization_id, pre_sales_user_id, period_start, period_end)
  WHERE pre_sales_user_id IS NOT NULL;

COMMENT ON COLUMN public.ote_sales_records.attribution_source IS
  'Fonte usada para atribuição histórica do resultado OTE (ex.: owner_history, qualified_by_user_id, attribution_pending).';

COMMENT ON COLUMN public.ote_sales_records.attribution_confidence IS
  'Confiança da atribuição histórica do OTE (high, medium, low, pending).';

COMMENT ON COLUMN public.ote_sales_records.commercial_commission_base IS
  'Receita válida/comissão elegível comercial da venda antes das exclusões item a item do OTE.';

COMMENT ON COLUMN public.ote_sales_records.eligible_ote_amount IS
  'Receita elegível para OTE após regra item a item.';