
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS activity_overdue_alert_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_scope text NOT NULL DEFAULT 'mine_only';
