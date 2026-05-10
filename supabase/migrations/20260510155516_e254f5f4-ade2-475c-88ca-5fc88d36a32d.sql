DROP FUNCTION IF EXISTS public.recalculate_account_rfm(uuid, date, date);

CREATE OR REPLACE FUNCTION public.recalculate_account_rfm(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_caller uuid := auth.uid();
  v_base_count integer := 0;
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

  -- Pré-checagem: existem vendas fechadas no período?
  SELECT COUNT(DISTINCT o.account_id)
    INTO v_base_count
  FROM public.opportunities o
  WHERE o.organization_id = p_organization_id
    AND o.deleted_at IS NULL
    AND o.status = 'won'
    AND o.account_id IS NOT NULL
    AND o.closed_at IS NOT NULL
    AND o.closed_at::date BETWEEN p_period_start AND p_period_end;

  IF v_base_count = 0 THEN
    -- Limpa snapshots obsoletos do período
    DELETE FROM public.account_rfm_snapshots s
    WHERE s.organization_id = p_organization_id
      AND s.period_start = p_period_start
      AND s.period_end = p_period_end;

    RETURN jsonb_build_object(
      'success', true,
      'processed_accounts', 0,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'message', 'Nenhuma conta com receita fechada encontrada no período.'
    );
  END IF;

  WITH base AS (
    SELECT
      o.account_id,
      (array_agg(o.owner_user_id ORDER BY o.closed_at DESC NULLS LAST)
        FILTER (WHERE o.owner_user_id IS NOT NULL))[1] AS owner_id,
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

  -- Remove snapshots obsoletos (contas que não têm mais wins no período)
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

  RETURN jsonb_build_object(
    'success', true,
    'processed_accounts', v_count,
    'period_start', p_period_start,
    'period_end', p_period_end
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recalculate_account_rfm(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_rfm_intelligence(uuid, date, date, uuid, text, text) TO authenticated;