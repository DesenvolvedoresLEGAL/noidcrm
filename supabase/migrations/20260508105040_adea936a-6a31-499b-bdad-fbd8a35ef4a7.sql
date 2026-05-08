-- 1. Add mirror columns to proposals to never lose customer feedback
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS win_reason_id uuid REFERENCES public.win_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS key_differentiator text,
  ADD COLUMN IF NOT EXISTS customer_feedback text;

-- 2. Trigger to mirror proposal feedback into win_loss_records on acceptance
CREATE OR REPLACE FUNCTION public.mirror_proposal_acceptance_to_win_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_opp RECORD;
BEGIN
  IF NEW.status <> 'accepted' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, valor_previsto, created_at
    INTO v_opp
    FROM public.opportunities
   WHERE id = NEW.opportunity_id;

  SELECT id INTO v_existing_id
    FROM public.win_loss_records
   WHERE opportunity_id = NEW.opportunity_id
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.win_loss_records (
      organization_id, opportunity_id, outcome,
      win_reason_id, key_differentiator, customer_feedback,
      final_value, sales_cycle_days,
      closed_by_proposal_id, recorded_by_customer,
      acceptor_name, acceptor_document, acceptor_position
    ) VALUES (
      NEW.organization_id, NEW.opportunity_id, 'won',
      NEW.win_reason_id, NEW.key_differentiator, NEW.customer_feedback,
      COALESCE(NEW.total_amount, NEW.value, v_opp.valor_previsto),
      CASE WHEN v_opp.created_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM (COALESCE(NEW.accepted_at, now()) - v_opp.created_at))::int)
        ELSE NULL END,
      NEW.id, true,
      NEW.acceptor_name, NEW.acceptor_document, NEW.acceptor_position
    );
  ELSE
    UPDATE public.win_loss_records SET
      outcome = 'won',
      win_reason_id = COALESCE(NEW.win_reason_id, win_reason_id),
      key_differentiator = COALESCE(NEW.key_differentiator, key_differentiator),
      customer_feedback = COALESCE(NEW.customer_feedback, customer_feedback),
      recorded_by_customer = true,
      acceptor_name = COALESCE(NEW.acceptor_name, acceptor_name),
      acceptor_document = COALESCE(NEW.acceptor_document, acceptor_document),
      acceptor_position = COALESCE(NEW.acceptor_position, acceptor_position),
      closed_by_proposal_id = COALESCE(closed_by_proposal_id, NEW.id)
    WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_proposal_acceptance_to_win_loss ON public.proposals;
CREATE TRIGGER trg_mirror_proposal_acceptance_to_win_loss
AFTER UPDATE OF status ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.mirror_proposal_acceptance_to_win_loss();

-- 3. Backfill: create win_loss_records for accepted-proposal won opps that have none
INSERT INTO public.win_loss_records (
  organization_id, opportunity_id, outcome,
  final_value, sales_cycle_days,
  closed_by_proposal_id, recorded_by_customer,
  acceptor_name, acceptor_document, acceptor_position,
  created_at
)
SELECT DISTINCT ON (o.id)
  o.organization_id, o.id, 'won',
  COALESCE(p.total_amount, p.value, o.valor_previsto),
  GREATEST(0, EXTRACT(DAY FROM (COALESCE(p.accepted_at, o.closed_at, now()) - o.created_at))::int),
  p.id, true,
  p.acceptor_name, p.acceptor_document, p.acceptor_position,
  COALESCE(p.accepted_at, o.closed_at, now())
FROM public.opportunities o
JOIN public.proposals p ON p.opportunity_id = o.id AND p.status = 'accepted'
WHERE o.status = 'won'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.win_loss_records w WHERE w.opportunity_id = o.id
  )
ORDER BY o.id, p.accepted_at DESC NULLS LAST;