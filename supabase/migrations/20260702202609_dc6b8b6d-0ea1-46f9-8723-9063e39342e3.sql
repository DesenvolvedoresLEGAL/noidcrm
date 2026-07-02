
-- KAI.18.5 — Apollo Query Logs para observabilidade e transparência total
CREATE TABLE IF NOT EXISTS public.apollo_query_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  prospect_id uuid NULL,
  triggered_by uuid NULL,
  endpoint text NOT NULL,
  mode text NOT NULL DEFAULT 'smart' CHECK (mode IN ('smart','raw','replay','system')),
  replay_of uuid NULL REFERENCES public.apollo_query_logs(id) ON DELETE SET NULL,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_headers_safe jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_status int NULL,
  response_body jsonb NULL,
  apollo_request_id text NULL,
  people_returned int NOT NULL DEFAULT 0,
  people_recommended int NOT NULL DEFAULT 0,
  people_hidden int NOT NULL DEFAULT 0,
  hidden_reasons jsonb NOT NULL DEFAULT '{}'::jsonb,
  credits_used int NOT NULL DEFAULT 0,
  cache_status text NOT NULL DEFAULT 'miss' CHECK (cache_status IN ('hit','miss','expired','bypass','invalidated')),
  fallback_used boolean NOT NULL DEFAULT false,
  latency_ms int NULL,
  retries int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','timeout','rate_limited')),
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.apollo_query_logs TO authenticated;
GRANT ALL ON public.apollo_query_logs TO service_role;

ALTER TABLE public.apollo_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apollo_query_logs_select_org_members"
  ON public.apollo_query_logs FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "apollo_query_logs_service_all"
  ON public.apollo_query_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_apollo_query_logs_prospect
  ON public.apollo_query_logs (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apollo_query_logs_org
  ON public.apollo_query_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apollo_query_logs_mode
  ON public.apollo_query_logs (organization_id, mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apollo_query_logs_status
  ON public.apollo_query_logs (organization_id, status, created_at DESC);

-- Retention (30 dias) via função helper — cron opcional depois
CREATE OR REPLACE FUNCTION public.cleanup_apollo_query_logs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.apollo_query_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
