
ALTER TABLE public.ote_monthly_results
  ADD COLUMN IF NOT EXISTS original_total_paid numeric,
  ADD COLUMN IF NOT EXISTS recalculated_total_paid numeric,
  ADD COLUMN IF NOT EXISTS calculation_origin text NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS recalculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS recalculated_by uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.ote_monthly_results
  DROP CONSTRAINT IF EXISTS ote_monthly_results_calculation_origin_check;
ALTER TABLE public.ote_monthly_results
  ADD CONSTRAINT ote_monthly_results_calculation_origin_check
  CHECK (calculation_origin IN ('initial','recalculated','historical','manual'));

-- Backfill Maio/2026: valor histórico oficial R$ 12.225,00 (proporcional ao recálculo)
UPDATE public.ote_monthly_results
SET original_total_paid = 7523.08,
    recalculated_total_paid = final_variable_amount,
    calculation_origin = 'recalculated',
    recalculated_at = COALESCE(recalculated_at, calculated_at)
WHERE period_month = '2026-05'
  AND user_id = 'fd4bbf6a-cf4e-490e-94ca-d47166277590';

UPDATE public.ote_monthly_results
SET original_total_paid = 4701.92,
    recalculated_total_paid = final_variable_amount,
    calculation_origin = 'recalculated',
    recalculated_at = COALESCE(recalculated_at, calculated_at)
WHERE period_month = '2026-05'
  AND user_id = 'f45f5762-ab85-4997-8e8a-e88fe8f596a7';
