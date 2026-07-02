
-- KAI.18.8 — Apollo Endpoint Matrix & Discovery

CREATE TABLE IF NOT EXISTS public.apollo_endpoint_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  prospect_id UUID NULL,
  query_log_id UUID NULL,
  parity_log_id UUID NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  http_status INTEGER NULL,
  payload JSONB NULL,
  response_summary JSONB NULL,
  returned_contacts INTEGER NULL,
  returned_companies INTEGER NULL,
  credits_used INTEGER NULL,
  latency_ms INTEGER NULL,
  ranking INTEGER NULL,
  stars SMALLINT NULL,
  recommended BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score NUMERIC(5,2) NULL,
  strategy TEXT NULL,
  source TEXT NOT NULL DEFAULT 'api',
  headers_seen JSONB NULL,
  notes TEXT NULL,
  executed_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apollo_endpoint_matrix_org_idx ON public.apollo_endpoint_matrix (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS apollo_endpoint_matrix_prospect_idx ON public.apollo_endpoint_matrix (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS apollo_endpoint_matrix_endpoint_idx ON public.apollo_endpoint_matrix (endpoint);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apollo_endpoint_matrix TO authenticated;
GRANT ALL ON public.apollo_endpoint_matrix TO service_role;

ALTER TABLE public.apollo_endpoint_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY apollo_endpoint_matrix_read_own_org
  ON public.apollo_endpoint_matrix FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY apollo_endpoint_matrix_service_all
  ON public.apollo_endpoint_matrix FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY apollo_endpoint_matrix_admin_write
  ON public.apollo_endpoint_matrix FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER trg_apollo_endpoint_matrix_updated
  BEFORE UPDATE ON public.apollo_endpoint_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.apollo_endpoint_discovery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL DEFAULT 'POST',
  status TEXT NOT NULL DEFAULT 'unknown',
  available BOOLEAN NOT NULL DEFAULT TRUE,
  documentation_url TEXT NULL,
  requires_auth_scope TEXT NULL,
  requires_cookie BOOLEAN NOT NULL DEFAULT FALSE,
  graphql BOOLEAN NOT NULL DEFAULT FALSE,
  internal_only BOOLEAN NOT NULL DEFAULT FALSE,
  public_only BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  last_seen_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.apollo_endpoint_discovery TO authenticated;
GRANT ALL ON public.apollo_endpoint_discovery TO service_role;

ALTER TABLE public.apollo_endpoint_discovery ENABLE ROW LEVEL SECURITY;

CREATE POLICY apollo_endpoint_discovery_read_all
  ON public.apollo_endpoint_discovery FOR SELECT
  TO authenticated USING (true);

CREATE POLICY apollo_endpoint_discovery_service_all
  ON public.apollo_endpoint_discovery FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_apollo_endpoint_discovery_updated
  BEFORE UPDATE ON public.apollo_endpoint_discovery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.apollo_endpoint_discovery (endpoint, method, status, available, documentation_url, requires_auth_scope, requires_cookie, graphql, internal_only, public_only, notes)
VALUES
  ('organizations/enrich', 'POST', 'documented', true, 'https://apolloapi.com/docs/reference/organization-enrichment', 'api_key', false, false, false, true, 'Retorna dados de uma organização por domínio.'),
  ('mixed_companies/search', 'POST', 'documented', true, 'https://apolloapi.com/docs/reference/organization-search', 'api_key', false, false, false, true, 'Busca organizações. Endpoint público.'),
  ('mixed_people/search', 'POST', 'documented', true, 'https://apolloapi.com/docs/reference/people-search', 'api_key', false, false, false, true, 'Endpoint atual usado pelo Kairós.'),
  ('people/search', 'POST', 'documented', true, 'https://apolloapi.com/docs/reference/people-search', 'api_key', false, false, false, true, 'Variante clássica.'),
  ('contacts/search', 'POST', 'documented', true, 'https://apolloapi.com/docs/reference/contact-search', 'api_key', false, false, false, false, 'Requer contatos já adicionados à conta Apollo.'),
  ('mixed_people/api_search', 'POST', 'documented', true, null, 'api_key', false, false, false, true, 'Alias usado hoje pelo backend Kairós.'),
  ('organization_people', 'POST', 'internal', true, null, 'web_session', true, false, true, false, 'Endpoint interno usado pela UI.'),
  ('recommended_people', 'POST', 'internal', false, null, 'web_session', true, false, true, false, 'Endpoint suspeito - pode não existir publicamente.'),
  ('graphql', 'POST', 'internal', true, null, 'web_session', true, true, true, false, 'GraphQL interno da Web UI.'),
  ('autocomplete', 'POST', 'internal', true, null, 'web_session', true, false, true, false, 'Sugestões de digitação.')
ON CONFLICT (endpoint) DO NOTHING;


ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS apollo_endpoint_strategy TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE public.organization_settings
  DROP CONSTRAINT IF EXISTS apollo_endpoint_strategy_check;
ALTER TABLE public.organization_settings
  ADD CONSTRAINT apollo_endpoint_strategy_check
  CHECK (apollo_endpoint_strategy IN ('auto','mixed_people','contacts','people','organization','graphql','custom'));
