
-- Enums
CREATE TYPE public.notification_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE public.notification_status_v2 AS ENUM ('pending','sent','read','dismissed','failed');
CREATE TYPE public.notification_channel AS ENUM ('in_app','email','push');
CREATE TYPE public.delivery_status AS ENUM ('queued','sent','failed');
CREATE TYPE public.digest_run_status AS ENUM ('pending','success','failed');

-- 1. notification_settings
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_digest_enabled boolean NOT NULL DEFAULT true,
  daily_digest_time text NOT NULL DEFAULT '06:00',
  daily_digest_email_enabled boolean NOT NULL DEFAULT true,
  daily_digest_dashboard_enabled boolean NOT NULL DEFAULT true,
  realtime_in_app_enabled boolean NOT NULL DEFAULT true,
  realtime_browser_push_enabled boolean NOT NULL DEFAULT false,
  realtime_email_enabled boolean NOT NULL DEFAULT false,
  proposal_view_alert_enabled boolean NOT NULL DEFAULT true,
  proposal_expiring_alert_enabled boolean NOT NULL DEFAULT true,
  client_reply_alert_enabled boolean NOT NULL DEFAULT true,
  activity_due_alert_enabled boolean NOT NULL DEFAULT true,
  team_events_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification settings"
  ON public.notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. notification_events
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_id uuid,
  contact_id uuid,
  proposal_id uuid,
  opportunity_id uuid,
  triggered_by_user_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read events"
  ON public.notification_events FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE INDEX idx_notification_events_type_date
  ON public.notification_events (event_type, occurred_at DESC);

-- 3. notifications_v2
CREATE TABLE public.notifications_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.notification_events(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  priority public.notification_priority NOT NULL DEFAULT 'medium',
  channel_in_app boolean NOT NULL DEFAULT true,
  channel_email boolean NOT NULL DEFAULT false,
  channel_push boolean NOT NULL DEFAULT false,
  status public.notification_status_v2 NOT NULL DEFAULT 'pending',
  action_url text,
  read_at timestamptz,
  dismissed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications_v2"
  ON public.notifications_v2 FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications_v2"
  ON public.notifications_v2 FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_v2_user_status
  ON public.notifications_v2 (user_id, status, created_at DESC);

-- 4. notification_delivery_logs
CREATE TABLE public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications_v2(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  delivery_status public.delivery_status NOT NULL DEFAULT 'queued',
  provider_response jsonb DEFAULT '{}'::jsonb,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function for delivery log access
CREATE OR REPLACE FUNCTION public.can_read_delivery_log(_log_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_delivery_logs dl
    JOIN public.notifications_v2 n ON n.id = dl.notification_id
    WHERE dl.id = _log_id
      AND n.user_id = auth.uid()
  )
$$;

CREATE POLICY "Users read own delivery logs"
  ON public.notification_delivery_logs FOR SELECT
  TO authenticated
  USING (public.can_read_delivery_log(id));

-- 5. browser_push_subscriptions
CREATE TABLE public.browser_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.browser_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.browser_push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subs_user_active
  ON public.browser_push_subscriptions (user_id, is_active);

-- 6. daily_digest_runs
CREATE TABLE public.daily_digest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  status public.digest_run_status NOT NULL DEFAULT 'pending',
  summary_payload jsonb DEFAULT '{}'::jsonb,
  email_sent boolean NOT NULL DEFAULT false,
  dashboard_cached boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_digest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own digest runs"
  ON public.daily_digest_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. daily_digest_cache
CREATE TABLE public.daily_digest_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_digest_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own digest cache"
  ON public.daily_digest_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_digest_cache_user_date
  ON public.daily_digest_cache (user_id, digest_date DESC);

-- Triggers for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_push_subs_updated_at
  BEFORE UPDATE ON public.browser_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
