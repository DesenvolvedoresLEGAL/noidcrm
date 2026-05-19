-- Backfill: realinha valor líquido aprovado em todas as propostas aceitas
-- e nas com tabela dinâmica ativa, evitando divergência com integrações.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.proposals
    WHERE deleted_at IS NULL
      AND (
        status = 'accepted'
        OR (dynamic_pricing_enabled IS TRUE AND dynamic_pricing_current_amount IS NOT NULL)
      )
  LOOP
    BEGIN
      PERFORM public.orchestrate_proposal_financials(r.id, 'api_deals_alignment_backfill_2026_05_19');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'orchestration failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;