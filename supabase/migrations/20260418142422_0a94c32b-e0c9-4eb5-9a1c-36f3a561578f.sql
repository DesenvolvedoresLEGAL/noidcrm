
-- ============================================================
-- SPRINT 10 — Governança, Deduplicação e Métricas Admin
-- ============================================================

-- 1. Tabela de chaves de dedup
CREATE TABLE IF NOT EXISTS public.notification_dedup_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  dedup_key text NOT NULL,
  event_type text NOT NULL,
  window_seconds integer NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_dedup_keys_unique UNIQUE (organization_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_dedup_keys_expires
  ON public.notification_dedup_keys (expires_at);

ALTER TABLE public.notification_dedup_keys ENABLE ROW LEVEL SECURITY;

-- Deny-all para clientes; só service role manipula
CREATE POLICY "deny all dedup keys" ON public.notification_dedup_keys
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 2. RPC atômica para tentar adquirir lock de dedup
CREATE OR REPLACE FUNCTION public.try_acquire_dedup_lock(
  p_organization_id uuid,
  p_dedup_key text,
  p_event_type text,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  -- Limpa chave expirada (se houver) antes de tentar inserir
  DELETE FROM public.notification_dedup_keys
  WHERE organization_id = p_organization_id
    AND dedup_key = p_dedup_key
    AND expires_at <= now();

  INSERT INTO public.notification_dedup_keys (
    organization_id, dedup_key, event_type, window_seconds, expires_at
  )
  VALUES (
    p_organization_id,
    p_dedup_key,
    p_event_type,
    p_window_seconds,
    now() + make_interval(secs => p_window_seconds)
  )
  ON CONFLICT (organization_id, dedup_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- 3. Cleanup periódico (função + cron diário)
CREATE OR REPLACE FUNCTION public.cleanup_expired_dedup_keys()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.notification_dedup_keys WHERE expires_at <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 4. Novas colunas em notifications_v2
ALTER TABLE public.notifications_v2
  ADD COLUMN IF NOT EXISTS fallback_chain text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz DEFAULT NULL;

-- 5. CHECK: action_url sempre interna
ALTER TABLE public.notifications_v2
  DROP CONSTRAINT IF EXISTS notifications_v2_action_url_internal;

ALTER TABLE public.notifications_v2
  ADD CONSTRAINT notifications_v2_action_url_internal
  CHECK (action_url IS NULL OR action_url ~ '^/[a-zA-Z0-9_/?&=%.\-]*$');

-- 6. RLS reforçada em notification_events
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read events from own org" ON public.notification_events;
CREATE POLICY "Users read events from own org" ON public.notification_events
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 7. View materializada de métricas admin
DROP MATERIALIZED VIEW IF EXISTS public.mv_notification_admin_metrics;

CREATE MATERIALIZED VIEW public.mv_notification_admin_metrics AS
WITH base AS (
  SELECT
    p.organization_id,
    date_trunc('day', n.created_at)::date AS day,
    n.type AS event_type,
    n.id,
    n.read_at,
    n.clicked_at
  FROM public.notifications_v2 n
  JOIN public.profiles p ON p.id = n.user_id
)
SELECT
  organization_id,
  day,
  event_type,
  COUNT(*) AS volume_sent,
  ROUND(100.0 * COUNT(read_at) / NULLIF(COUNT(*),0), 2) AS read_rate_pct,
  ROUND(100.0 * COUNT(clicked_at) / NULLIF(COUNT(*),0), 2) AS click_rate_pct
FROM base
GROUP BY organization_id, day, event_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_notif_admin_metrics
  ON public.mv_notification_admin_metrics (organization_id, day, event_type);

-- 8. RPC de leitura de métricas (admins/owners da org)
CREATE OR REPLACE FUNCTION public.get_notification_admin_metrics(
  p_organization_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE(
  day date,
  event_type text,
  volume_sent bigint,
  read_rate_pct numeric,
  click_rate_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garante que requester pertence à org E é admin/owner
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.organization_id = p_organization_id
      AND pr.role IN ('admin','owner','manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT m.day, m.event_type, m.volume_sent, m.read_rate_pct, m.click_rate_pct
  FROM public.mv_notification_admin_metrics m
  WHERE m.organization_id = p_organization_id
    AND m.day BETWEEN p_from AND p_to
  ORDER BY m.day DESC, m.volume_sent DESC;
END;
$$;

-- 9. Cron diário para limpar dedup keys expiradas e refresh da view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    -- Remove jobs antigos com mesmo nome
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('cleanup-notification-dedup', 'refresh-notification-admin-metrics');

    PERFORM cron.schedule(
      'cleanup-notification-dedup',
      '15 3 * * *',
      $cron$ SELECT public.cleanup_expired_dedup_keys(); $cron$
    );

    PERFORM cron.schedule(
      'refresh-notification-admin-metrics',
      '*/15 * * * *',
      $cron$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_notification_admin_metrics; $cron$
    );
  END IF;
END $$;
