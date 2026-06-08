CREATE OR REPLACE FUNCTION public.search_proposals_global(
  _q text DEFAULT NULL,
  _status text DEFAULT NULL,
  _owner_id uuid DEFAULT NULL,
  _min_value numeric DEFAULT NULL,
  _max_value numeric DEFAULT NULL,
  _year integer DEFAULT NULL,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  qn text := NULLIF(btrim(_q), '');
  pat text := CASE WHEN qn IS NULL THEN NULL ELSE '%' || unaccent(lower(qn)) || '%' END;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT p.id, p.created_at
    FROM public.proposals p
    LEFT JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts a ON a.id = o.account_id
    WHERE p.deleted_at IS NULL
      AND (_status IS NULL OR p.status = _status)
      AND (_owner_id IS NULL OR o.owner_user_id = _owner_id)
      AND (_min_value IS NULL OR COALESCE(p.total_amount, p.value, 0) >= _min_value)
      AND (_max_value IS NULL OR COALESCE(p.total_amount, p.value, 0) <= _max_value)
      AND (_year IS NULL OR EXTRACT(YEAR FROM p.created_at)::int = _year)
      AND (_date_from IS NULL OR p.created_at::date >= _date_from)
      AND (_date_to IS NULL OR p.created_at::date <= _date_to)
      AND (
        qn IS NULL
        OR unaccent(lower(COALESCE(p.title,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.client_name,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.client_email,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.proposal_number,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.introduction,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.notes,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.terms,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.content::text,''))) LIKE pat
        OR unaccent(lower(COALESCE(p.event_location,''))) LIKE pat
        OR unaccent(lower(COALESCE(o.title,''))) LIKE pat
        OR unaccent(lower(COALESCE(a.razao_social,''))) LIKE pat
        OR unaccent(lower(COALESCE(a.nome_fantasia,''))) LIKE pat
        OR EXISTS (
          SELECT 1 FROM public.proposal_items pi
          WHERE pi.proposal_id = p.id
            AND (
              unaccent(lower(COALESCE(pi.name,''))) LIKE pat
              OR unaccent(lower(COALESCE(pi.description,''))) LIKE pat
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.contacts c
          WHERE c.account_id = a.id
            AND c.deleted_at IS NULL
            AND (
              unaccent(lower(COALESCE(c.nome,''))) LIKE pat
              OR unaccent(lower(COALESCE(c.emails::text,''))) LIKE pat
              OR unaccent(lower(COALESCE(c.telefones::text,''))) LIKE pat
            )
        )
      )
  )
  SELECT b.id, COUNT(*) OVER()::bigint AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_proposals_global(text,text,uuid,numeric,numeric,integer,date,date,integer,integer) TO authenticated, service_role;