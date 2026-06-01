-- Sprint WL-UI-03 — Falha Comercial oficial: classificação por motivo (catálogo).
-- Adiciona accountability oficial ao loss_reasons (5 valores controlados).
-- Não altera a semântica do campo loss_accountability em opportunities/win_loss_records
-- (que continua representando a culpa declarada pelo vendedor: client/competition/us).

ALTER TABLE public.loss_reasons
  ADD COLUMN IF NOT EXISTS loss_accountability text NOT NULL DEFAULT 'unknown';

-- Constraint controlada (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loss_reasons_loss_accountability_chk'
  ) THEN
    ALTER TABLE public.loss_reasons
      ADD CONSTRAINT loss_reasons_loss_accountability_chk
      CHECK (loss_accountability IN ('commercial','client','operations','market','unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loss_reasons_loss_accountability
  ON public.loss_reasons(loss_accountability);

COMMENT ON COLUMN public.loss_reasons.loss_accountability IS
  'Sprint WL-UI-03 — Classificação oficial de accountability do motivo de perda. Valores: commercial, client, operations, market, unknown. Usado em métricas oficiais (Perda por Falha Comercial).';

-- Backfill determinístico a partir da categoria existente.
-- Mapeamento conservador; admins podem reclassificar via UI futuramente.
UPDATE public.loss_reasons
SET loss_accountability = CASE
  WHEN category IN ('timing','sales_process','internal') THEN 'commercial'
  WHEN category IN ('no_fit')                              THEN 'client'
  WHEN category IN ('operational')                         THEN 'operations'
  WHEN category IN ('competition','price')                 THEN 'market'
  ELSE 'unknown'
END
WHERE loss_accountability = 'unknown';
