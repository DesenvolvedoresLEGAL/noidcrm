
-- =========================================================
-- Sprint Contas 1.1 — RFM Intelligence
-- =========================================================

CREATE TABLE IF NOT EXISTS public.account_rfm_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  account_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  owner_id uuid,
  last_won_date timestamptz,
  won_count integer NOT NULL DEFAULT 0,
  total_revenue numeric(15,2) NOT NULL DEFAULT 0,
  avg_ticket numeric(15,2) NOT NULL DEFAULT 0,
  recency_days integer,
  r_score smallint NOT NULL DEFAULT 0,
  f_score smallint NOT NULL DEFAULT 0,
  m_score smallint NOT NULL DEFAULT 0,
  rfm_score numeric(6,2) NOT NULL DEFAULT 0,
  rfm_segment text NOT NULL DEFAULT 'perdido',
  suggested_action text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_rfm_snapshots_unique UNIQUE (organization_id, account_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_arfs_org ON public.account_rfm_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_arfs_account ON public.account_rfm_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_arfs_period ON public.account_rfm_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_arfs_segment ON public.account_rfm_snapshots(rfm_segment);

ALTER TABLE public.account_rfm_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RFM snapshots: org members can view" ON public.account_rfm_snapshots;
CREATE POLICY "RFM snapshots: org members can view"
  ON public.account_rfm_snapshots FOR SELECT
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "RFM snapshots: admin/owner insert" ON public.account_rfm_snapshots;
CREATE POLICY "RFM snapshots: admin/owner insert"
  ON public.account_rfm_snapshots FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  );

DROP POLICY IF EXISTS "RFM snapshots: admin/owner update" ON public.account_rfm_snapshots;
CREATE POLICY "RFM snapshots: admin/owner update"
  ON public.account_rfm_snapshots FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  );

DROP POLICY IF EXISTS "RFM snapshots: admin/owner delete" ON public.account_rfm_snapshots;
CREATE POLICY "RFM snapshots: admin/owner delete"
  ON public.account_rfm_snapshots FOR DELETE
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  );

CREATE TRIGGER trg_arfs_updated_at
  BEFORE UPDATE ON public.account_rfm_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- recalculate_account_rfm
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalculate_account_rfm(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF p_organization_id <> public.get_user_organization_id() THEN
    RAISE EXCEPTION 'forbidden: organization mismatch';
  END IF;
  IF NOT (public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'owner')) THEN
    RAISE EXCEPTION 'forbidden: admin or owner only';
  END IF;

  WITH base AS (
    SELECT
      o.account_id,
      MAX(o.owner_user_id) AS owner_id,
      MAX(o.closed_at) AS last_won_date,
      COUNT(*)::int AS won_count,
      COALESCE(SUM(o.valor_previsto), 0)::numeric(15,2) AS total_revenue
    FROM public.opportunities o
    WHERE o.organization_id = p_organization_id
      AND o.deleted_at IS NULL
      AND o.status = 'won'
      AND o.account_id IS NOT NULL
      AND o.closed_at IS NOT NULL
      AND o.closed_at::date BETWEEN p_period_start AND p_period_end
    GROUP BY o.account_id
  ),
  ranked AS (
    SELECT
      b.*,
      CASE WHEN b.won_count = 0 THEN 0
           ELSE (b.total_revenue / b.won_count)::numeric(15,2)
      END AS avg_ticket,
      (p_period_end - b.last_won_date::date) AS recency_days,
      percent_rank() OVER (ORDER BY b.total_revenue) AS pct_rank
    FROM base b
  ),
  scored AS (
    SELECT
      r.*,
      CASE
        WHEN r.last_won_date IS NULL THEN 0
        WHEN r.recency_days <= 30 THEN 5
        WHEN r.recency_days <= 60 THEN 4
        WHEN r.recency_days <= 120 THEN 3
        WHEN r.recency_days <= 180 THEN 2
        ELSE 1
      END::smallint AS r_score,
      CASE
        WHEN r.won_count >= 5 THEN 5
        WHEN r.won_count = 4 THEN 4
        WHEN r.won_count = 3 THEN 3
        WHEN r.won_count = 2 THEN 2
        WHEN r.won_count = 1 THEN 1
        ELSE 0
      END::smallint AS f_score,
      CASE
        WHEN r.total_revenue <= 0 THEN 0
        WHEN r.pct_rank >= 0.80 THEN 5
        WHEN r.pct_rank >= 0.60 THEN 4
        WHEN r.pct_rank >= 0.40 THEN 3
        WHEN r.pct_rank >= 0.20 THEN 2
        ELSE 1
      END::smallint AS m_score
    FROM ranked r
  ),
  classified AS (
    SELECT
      s.*,
      ROUND(((s.r_score + s.f_score + s.m_score)::numeric / 15.0) * 100, 2) AS rfm_score,
      CASE
        WHEN s.r_score >= 4 AND s.f_score >= 4 AND s.m_score >= 4 THEN 'campeao'
        WHEN s.m_score >= 5 AND s.r_score >= 3 AND s.f_score >= 2 THEN 'vip'
        WHEN s.f_score >= 4 AND s.r_score >= 3 AND s.m_score >= 2 THEN 'leal'
        WHEN s.r_score >= 4 AND s.f_score = 1 THEN 'novo_cliente'
        WHEN s.r_score >= 4 AND s.f_score <= 2 AND s.m_score >= 2 THEN 'promissor'
        WHEN s.r_score = 3 AND s.f_score >= 2 THEN 'precisa_atencao'
        WHEN s.r_score = 2 AND s.f_score >= 2 THEN 'em_risco'
        WHEN s.r_score = 1 AND s.f_score >= 1 THEN 'hibernando'
        ELSE 'perdido'
      END AS rfm_segment
    FROM scored s
  ),
  with_action AS (
    SELECT
      c.*,
      CASE c.rfm_segment
        WHEN 'campeao' THEN 'Pedir indicação, oferecer plano premium, convidar para case ou beta'
        WHEN 'vip' THEN 'Estratégia de expansão e upsell'
        WHEN 'leal' THEN 'Manter relacionamento e aumentar ticket'
        WHEN 'promissor' THEN 'Estimular a segunda compra'
        WHEN 'novo_cliente' THEN 'Onboarding forte e ativação'
        WHEN 'precisa_atencao' THEN 'Contato consultivo proativo'
        WHEN 'em_risco' THEN 'Contato imediato para retenção'
        WHEN 'hibernando' THEN 'Campanha de reativação'
        ELSE 'Sequência de winback'
      END AS suggested_action
    FROM classified c
  ),
  upserted AS (
    INSERT INTO public.account_rfm_snapshots (
      organization_id, account_id, period_start, period_end, owner_id,
      last_won_date, won_count, total_revenue, avg_ticket, recency_days,
      r_score, f_score, m_score, rfm_score, rfm_segment, suggested_action, calculated_at
    )
    SELECT
      p_organization_id, w.account_id, p_period_start, p_period_end, w.owner_id,
      w.last_won_date, w.won_count, w.total_revenue, w.avg_ticket, w.recency_days,
      w.r_score, w.f_score, w.m_score, w.rfm_score, w.rfm_segment, w.suggested_action, now()
    FROM with_action w
    ON CONFLICT (organization_id, account_id, period_start, period_end)
    DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      last_won_date = EXCLUDED.last_won_date,
      won_count = EXCLUDED.won_count,
      total_revenue = EXCLUDED.total_revenue,
      avg_ticket = EXCLUDED.avg_ticket,
      recency_days = EXCLUDED.recency_days,
      r_score = EXCLUDED.r_score,
      f_score = EXCLUDED.f_score,
      m_score = EXCLUDED.m_score,
      rfm_score = EXCLUDED.rfm_score,
      rfm_segment = EXCLUDED.rfm_segment,
      suggested_action = EXCLUDED.suggested_action,
      calculated_at = EXCLUDED.calculated_at,
      updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_count FROM upserted;

  -- Remove stale snapshots for this period (accounts that no longer have wins)
  DELETE FROM public.account_rfm_snapshots s
  WHERE s.organization_id = p_organization_id
    AND s.period_start = p_period_start
    AND s.period_end = p_period_end
    AND s.account_id NOT IN (
      SELECT o.account_id FROM public.opportunities o
      WHERE o.organization_id = p_organization_id
        AND o.deleted_at IS NULL
        AND o.status = 'won'
        AND o.account_id IS NOT NULL
        AND o.closed_at IS NOT NULL
        AND o.closed_at::date BETWEEN p_period_start AND p_period_end
    );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_account_rfm(uuid, date, date) TO authenticated;

-- =========================================================
-- get_account_rfm_intelligence
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_account_rfm_intelligence(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_owner_id uuid DEFAULT NULL,
  p_segment text DEFAULT NULL,
  p_search text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_overview jsonb;
  v_segments jsonb;
  v_accounts jsonb;
  v_actions jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF p_organization_id <> public.get_user_organization_id() THEN
    RAISE EXCEPTION 'forbidden: organization mismatch';
  END IF;

  -- All snapshots for the period and org (segment counts use full base)
  WITH base AS (
    SELECT s.*,
           COALESCE(a.nome_fantasia, a.razao_social) AS account_name,
           a.razao_social,
           p.full_name AS owner_name
    FROM public.account_rfm_snapshots s
    LEFT JOIN public.accounts a ON a.id = s.account_id
    LEFT JOIN public.profiles p ON p.id = s.owner_id
    WHERE s.organization_id = p_organization_id
      AND s.period_start = p_period_start
      AND s.period_end = p_period_end
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)
      AND (p_segment IS NULL OR rfm_segment = p_segment)
      AND (p_search IS NULL OR p_search = '' OR account_name ILIKE '%' || p_search || '%' OR razao_social ILIKE '%' || p_search || '%')
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS clientes_analisados,
      COALESCE(SUM(total_revenue), 0)::numeric(15,2) AS receita_total,
      CASE WHEN SUM(won_count) > 0 THEN (SUM(total_revenue) / SUM(won_count))::numeric(15,2) ELSE 0 END AS ticket_medio,
      COALESCE(AVG(rfm_score), 0)::numeric(6,2) AS score_rfm_medio
    FROM base
  )
  SELECT jsonb_build_object(
    'clientes_analisados', t.clientes_analisados,
    'receita_total', t.receita_total,
    'ticket_medio', t.ticket_medio,
    'score_rfm_medio', t.score_rfm_medio,
    'campeoes', (SELECT COUNT(*) FROM base WHERE rfm_segment = 'campeao'),
    'vip', (SELECT COUNT(*) FROM base WHERE rfm_segment = 'vip'),
    'leais', (SELECT COUNT(*) FROM base WHERE rfm_segment = 'leal'),
    'em_risco', (SELECT COUNT(*) FROM base WHERE rfm_segment = 'em_risco'),
    'hibernando', (SELECT COUNT(*) FROM base WHERE rfm_segment = 'hibernando'),
    'perdidos', (SELECT COUNT(*) FROM base WHERE rfm_segment = 'perdido')
  ) INTO v_overview FROM totals t;

  WITH base AS (
    SELECT s.*
    FROM public.account_rfm_snapshots s
    WHERE s.organization_id = p_organization_id
      AND s.period_start = p_period_start
      AND s.period_end = p_period_end
  ),
  agg AS (
    SELECT rfm_segment,
           COUNT(*)::int AS count,
           COALESCE(SUM(total_revenue),0)::numeric(15,2) AS revenue,
           CASE WHEN SUM(won_count) > 0 THEN (SUM(total_revenue)/SUM(won_count))::numeric(15,2) ELSE 0 END AS avg_ticket
    FROM base
    GROUP BY rfm_segment
  ),
  total AS (SELECT COUNT(*)::numeric AS c FROM base)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'segment', a.rfm_segment,
    'count', a.count,
    'revenue', a.revenue,
    'avg_ticket', a.avg_ticket,
    'percent', CASE WHEN total.c > 0 THEN ROUND((a.count::numeric / total.c) * 100, 2) ELSE 0 END,
    'action', CASE a.rfm_segment
      WHEN 'campeao' THEN 'Pedir indicação, oferecer plano premium, convidar para case ou beta'
      WHEN 'vip' THEN 'Estratégia de expansão e upsell'
      WHEN 'leal' THEN 'Manter relacionamento e aumentar ticket'
      WHEN 'promissor' THEN 'Estimular a segunda compra'
      WHEN 'novo_cliente' THEN 'Onboarding forte e ativação'
      WHEN 'precisa_atencao' THEN 'Contato consultivo proativo'
      WHEN 'em_risco' THEN 'Contato imediato para retenção'
      WHEN 'hibernando' THEN 'Campanha de reativação'
      ELSE 'Sequência de winback'
    END
  )), '[]'::jsonb) INTO v_segments FROM agg a, total;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'account_id', f.account_id,
    'account_name', f.account_name,
    'last_won_date', f.last_won_date,
    'won_count', f.won_count,
    'total_revenue', f.total_revenue,
    'avg_ticket', f.avg_ticket,
    'recency_days', f.recency_days,
    'r_score', f.r_score,
    'f_score', f.f_score,
    'm_score', f.m_score,
    'rfm_score', f.rfm_score,
    'rfm_segment', f.rfm_segment,
    'suggested_action', f.suggested_action,
    'owner_id', f.owner_id,
    'owner_name', f.owner_name
  ) ORDER BY f.total_revenue DESC), '[]'::jsonb) INTO v_accounts
  FROM (
    SELECT s.*,
           COALESCE(a.nome_fantasia, a.razao_social) AS account_name,
           a.razao_social,
           p.full_name AS owner_name
    FROM public.account_rfm_snapshots s
    LEFT JOIN public.accounts a ON a.id = s.account_id
    LEFT JOIN public.profiles p ON p.id = s.owner_id
    WHERE s.organization_id = p_organization_id
      AND s.period_start = p_period_start
      AND s.period_end = p_period_end
      AND (p_owner_id IS NULL OR s.owner_id = p_owner_id)
      AND (p_segment IS NULL OR s.rfm_segment = p_segment)
      AND (p_search IS NULL OR p_search = '' OR COALESCE(a.nome_fantasia, a.razao_social) ILIKE '%' || p_search || '%' OR a.razao_social ILIKE '%' || p_search || '%')
  ) f;

  v_actions := jsonb_build_object(
    'campeao', 'Pedir indicação, oferecer plano premium, convite para beta ou case de sucesso.',
    'vip', 'Estratégia de expansão: upsell, cross-sell e contas estratégicas.',
    'leal', 'Manter relacionamento e aumentar ticket médio.',
    'promissor', 'Estimular a segunda compra com oferta personalizada.',
    'novo_cliente', 'Onboarding forte e ativação inicial.',
    'precisa_atencao', 'Contato consultivo para entender contexto.',
    'em_risco', 'Contato imediato para retenção e diagnóstico.',
    'hibernando', 'Campanha de reativação multicanal.',
    'perdido', 'Sequência de winback estruturada.'
  );

  v_result := jsonb_build_object(
    'overview', v_overview,
    'segments', v_segments,
    'accounts', v_accounts,
    'recommended_actions', v_actions
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_rfm_intelligence(uuid, date, date, uuid, text, text) TO authenticated;
