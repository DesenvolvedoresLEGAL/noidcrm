-- 1) Add distribution columns to pipelines
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS lead_distribution_strategy TEXT DEFAULT 'none'
    CHECK (lead_distribution_strategy IN ('none','round_robin','load_balanced','random','territory','manual_assignment')),
  ADD COLUMN IF NOT EXISTS lead_distribution_role TEXT
    CHECK (lead_distribution_role IS NULL OR lead_distribution_role IN ('sdr','seller','closer','cs','am','farmer','ae')),
  ADD COLUMN IF NOT EXISTS lead_distribution_user_ids UUID[] DEFAULT '{}';

-- 2) RPC: claim_next_owner_v2
CREATE OR REPLACE FUNCTION public.claim_next_owner_v2(
  _organization_id UUID,
  _pipeline_id TEXT DEFAULT NULL,
  _account_uf TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _strategy TEXT;
  _role TEXT;
  _user_ids UUID[];
  _chosen UUID;
BEGIN
  -- Read pipeline config
  IF _pipeline_id IS NOT NULL THEN
    SELECT lead_distribution_strategy, lead_distribution_role, lead_distribution_user_ids
    INTO _strategy, _role, _user_ids
    FROM public.pipelines
    WHERE id = _pipeline_id AND organization_id = _organization_id;
  END IF;

  IF _strategy IS NULL OR _strategy = 'none' OR _strategy = 'manual_assignment' THEN
    RETURN NULL;
  END IF;

  -- Build candidate pool: explicit list, otherwise active sellers matching role
  WITH candidates AS (
    SELECT s.user_id
    FROM public.sellers s
    WHERE s.organization_id = _organization_id
      AND s.active = true
      AND s.user_id IS NOT NULL
      AND (
        _user_ids IS NULL
        OR array_length(_user_ids, 1) IS NULL
        OR s.user_id = ANY(_user_ids)
      )
      AND (
        _role IS NULL
        OR (
          (_role = 'sdr'    AND s.role::text ILIKE 'SDR') OR
          (_role = 'seller' AND s.role::text IN ('Closer','AE','AM','Farmer')) OR
          (_role = 'closer' AND s.role::text = 'Closer') OR
          (_role = 'cs'     AND s.role::text = 'CS') OR
          (_role = 'am'     AND s.role::text = 'AM') OR
          (_role = 'farmer' AND s.role::text = 'Farmer') OR
          (_role = 'ae'     AND s.role::text = 'AE')
        )
      )
  )
  SELECT CASE _strategy
    WHEN 'round_robin' THEN (
      SELECT c.user_id FROM candidates c
      LEFT JOIN public.owner_queue oq
        ON oq.user_id = c.user_id AND oq.organization_id = _organization_id
      ORDER BY oq.last_assigned_at NULLS FIRST, c.user_id
      LIMIT 1
    )
    WHEN 'load_balanced' THEN (
      SELECT c.user_id
      FROM candidates c
      LEFT JOIN LATERAL (
        SELECT count(*) AS cnt
        FROM public.opportunities o
        WHERE o.owner_user_id = c.user_id
          AND o.organization_id = _organization_id
          AND o.deleted_at IS NULL
          AND o.status IN ('new','open','in_progress')
      ) ld ON true
      ORDER BY ld.cnt ASC NULLS FIRST, c.user_id
      LIMIT 1
    )
    WHEN 'random' THEN (
      SELECT c.user_id FROM candidates c ORDER BY random() LIMIT 1
    )
    WHEN 'territory' THEN (
      SELECT c.user_id FROM candidates c
      WHERE _account_uf IS NULL OR EXISTS (
        SELECT 1 FROM public.territories t
        WHERE t.user_id = c.user_id
          AND t.organization_id = _organization_id
          AND _account_uf = ANY(t.uf_list)
      )
      ORDER BY c.user_id
      LIMIT 1
    )
    ELSE NULL
  END INTO _chosen;

  -- Update owner_queue last_assigned_at if applicable
  IF _chosen IS NOT NULL AND _strategy = 'round_robin' THEN
    INSERT INTO public.owner_queue (organization_id, user_id, is_active, role_filter, last_assigned_at)
    VALUES (_organization_id, _chosen, true, _role, now())
    ON CONFLICT DO NOTHING;
    UPDATE public.owner_queue
      SET last_assigned_at = now()
      WHERE organization_id = _organization_id AND user_id = _chosen;
  END IF;

  RETURN _chosen;
END;
$$;

-- 3) Aggregated porte summary for /accounts KPIs
CREATE OR REPLACE FUNCTION public.get_accounts_porte_summary(_organization_id UUID)
RETURNS TABLE (
  total BIGINT,
  mei BIGINT,
  me BIGINT,
  epp BIGINT,
  medio BIGINT,
  grande BIGINT,
  sem_porte BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH norm AS (
    SELECT
      CASE upper(coalesce(trim(porte), ''))
        WHEN 'MEI' THEN 'MEI'
        WHEN 'MICROEMPREENDEDOR INDIVIDUAL' THEN 'MEI'
        WHEN 'MICRO EMPREENDEDOR INDIVIDUAL' THEN 'MEI'
        WHEN 'ME' THEN 'ME'
        WHEN 'MICRO' THEN 'ME'
        WHEN 'MICROEMPRESA' THEN 'ME'
        WHEN 'MICRO EMPRESA' THEN 'ME'
        WHEN 'EPP' THEN 'EPP'
        WHEN 'PEQUENO' THEN 'EPP'
        WHEN 'PEQUENO PORTE' THEN 'EPP'
        WHEN 'PEQUENA' THEN 'EPP'
        WHEN 'EMPRESA DE PEQUENO PORTE' THEN 'EPP'
        WHEN 'MEDIO' THEN 'MEDIO'
        WHEN 'MÉDIO' THEN 'MEDIO'
        WHEN 'MEDIA' THEN 'MEDIO'
        WHEN 'MÉDIA' THEN 'MEDIO'
        WHEN 'MEDIO PORTE' THEN 'MEDIO'
        WHEN 'MÉDIO PORTE' THEN 'MEDIO'
        WHEN 'EMPRESA DE MEDIO PORTE' THEN 'MEDIO'
        WHEN 'EMPRESA DE MÉDIO PORTE' THEN 'MEDIO'
        WHEN 'GRANDE' THEN 'GRANDE'
        WHEN 'GRANDE PORTE' THEN 'GRANDE'
        WHEN 'EMPRESA DE GRANDE PORTE' THEN 'GRANDE'
        WHEN 'DEMAIS' THEN 'GRANDE'
        ELSE NULL
      END AS canon
    FROM public.accounts
    WHERE organization_id = _organization_id
      AND deleted_at IS NULL
  )
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE canon = 'MEI')::bigint AS mei,
    count(*) FILTER (WHERE canon = 'ME')::bigint AS me,
    count(*) FILTER (WHERE canon = 'EPP')::bigint AS epp,
    count(*) FILTER (WHERE canon = 'MEDIO')::bigint AS medio,
    count(*) FILTER (WHERE canon = 'GRANDE')::bigint AS grande,
    count(*) FILTER (WHERE canon IS NULL)::bigint AS sem_porte
  FROM norm;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_owner_v2(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accounts_porte_summary(UUID) TO authenticated;