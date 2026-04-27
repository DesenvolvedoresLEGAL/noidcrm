
ALTER TABLE public.revenue_events
ADD COLUMN IF NOT EXISTS event_class TEXT
CHECK (event_class IN ('action','outcome','system'));

CREATE INDEX IF NOT EXISTS idx_revenue_events_class
  ON public.revenue_events (organization_id, event_class, created_at DESC);

UPDATE public.revenue_events
SET event_class = CASE
  WHEN event_type IN (
    'email_replied','whatsapp_replied','meeting_booked',
    'opportunity_qualified','opportunity_disqualified',
    'deal_won','deal_lost','email_bounced','unsubscribed'
  ) THEN 'outcome'
  WHEN event_type IN (
    'email_sent','email_delivered','email_opened','email_clicked',
    'whatsapp_sent','call_made','call_connected','task_created'
  ) THEN 'action'
  ELSE 'system'
END
WHERE event_class IS NULL;

ALTER TABLE public.learning_signals
ADD COLUMN IF NOT EXISTS attribution_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.revenue_events(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  prospect_id UUID,
  opportunity_id UUID,
  outcome TEXT NOT NULL CHECK (outcome IN ('positive','negative')),
  weight INT NOT NULL DEFAULT 1,
  process_after TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','cancelled','failed')),
  attempts INT NOT NULL DEFAULT 0,
  error TEXT,
  cancelled_reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_learning_queue_due
  ON public.learning_queue (status, process_after)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_learning_queue_org_status
  ON public.learning_queue (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_queue_prospect_pending
  ON public.learning_queue (prospect_id, status)
  WHERE status = 'pending';

ALTER TABLE public.learning_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read learning_queue" ON public.learning_queue;
CREATE POLICY "Org members can read learning_queue"
  ON public.learning_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = learning_queue.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.deleted_at IS NULL
    )
  );
