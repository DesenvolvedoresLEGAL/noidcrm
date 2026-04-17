ALTER TABLE public.notifications_v2 
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_v2_user_inbox 
  ON public.notifications_v2 (user_id, created_at DESC) 
  WHERE dismissed_at IS NULL;