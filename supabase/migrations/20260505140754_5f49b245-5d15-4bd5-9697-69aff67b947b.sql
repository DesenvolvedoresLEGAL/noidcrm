ALTER TABLE public.ai_suggestions
  ADD COLUMN IF NOT EXISTS context_signature text;

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending_lookup
  ON public.ai_suggestions (opportunity_id, suggestion_type, status)
  WHERE status = 'pending';