
ALTER TABLE public.ai_email_messages
  ADD COLUMN IF NOT EXISTS send_failure_reason text,
  ADD COLUMN IF NOT EXISTS send_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_send_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_failed_at timestamptz;

-- Índice para listar itens com falha de envio rapidamente
CREATE INDEX IF NOT EXISTS idx_ai_email_messages_send_status
  ON public.ai_email_messages(send_status)
  WHERE send_status IN ('failed','approved');

-- Índice para fila resiliente
CREATE INDEX IF NOT EXISTS idx_ai_agent_approval_queue_status_org
  ON public.ai_agent_approval_queue(organization_id, status, requested_at DESC);
