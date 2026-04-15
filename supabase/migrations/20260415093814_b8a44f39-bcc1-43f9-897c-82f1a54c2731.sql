
ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS proposal_expiring_alert_enabled boolean DEFAULT true;
