-- Sprint 6.1: lightweight audit table
CREATE TABLE IF NOT EXISTS public.crm_closer_dashboard_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  viewer_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'preview',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closer_views_tenant_created
  ON public.crm_closer_dashboard_views (tenant_id, created_at DESC);

ALTER TABLE public.crm_closer_dashboard_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "closer_views_admin_select" ON public.crm_closer_dashboard_views;
CREATE POLICY "closer_views_admin_select"
  ON public.crm_closer_dashboard_views
  FOR SELECT TO authenticated
  USING (public.user_is_org_admin(tenant_id));

DROP POLICY IF EXISTS "closer_views_self_insert" ON public.crm_closer_dashboard_views;
CREATE POLICY "closer_views_self_insert"
  ON public.crm_closer_dashboard_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_user_id = auth.uid());

-- Sprint 6.1: replace RPC with severity, why_here, stage stalled, separated lists
CREATE OR REPLACE FUNCTION public.crm_get_closer_dashboard_data(
  p_tenant_id uuid,
  p_user_id uuid,
  p_period text DEFAULT 'current_month',
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_is_admin boolean := false;
  v_caller_in_tenant boolean := false;
  v_target_in_tenant boolean := false;
  v_business_function text;
  v_permission_key text;
  v_department_key text;
  v_requires_review boolean := false;
  v_target_name text;
  v_target_email text;
  v_start timestamptz;
  v_end timestamptz;
  v_period_key text := COALESCE(p_period, 'current_month');
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_kpis jsonb;
  v_central jsonb;
  v_lists jsonb;
  v_availability jsonb;
  v_goal numeric;
  v_goal_source text := 'sales_goals';
  v_goal_warning jsonb := 'null'::jsonb;
  v_revenue numeric := 0;
  v_won_count integer := 0;
  v_lost_count integer := 0;
  v_avg_ticket numeric;
  v_win_rate numeric;
  v_attainment numeric;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_tenant_id AND om.user_id = v_caller
      AND COALESCE(om.is_active, true) = true
  ) INTO v_caller_in_tenant;
  IF NOT v_caller_in_tenant THEN
    RAISE EXCEPTION 'forbidden_tenant' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_caller_is_admin := public.user_is_org_admin(p_tenant_id);
  EXCEPTION WHEN OTHERS THEN
    v_caller_is_admin := false;
  END;
  IF NOT v_caller_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = p_tenant_id AND om.user_id = v_caller
        AND om.role IN ('owner','admin')
    ) INTO v_caller_is_admin;
  END IF;

  IF v_caller <> p_user_id AND NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'forbidden_target' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_tenant_id AND om.user_id = p_user_id
  ) INTO v_target_in_tenant;
  IF NOT v_target_in_tenant THEN
    RAISE EXCEPTION 'target_not_in_tenant' USING ERRCODE = '42501';
  END IF;

  SELECT v.business_function_key, v.permission_key, v.department_key, COALESCE(v.requires_review,false)
    INTO v_business_function, v_permission_key, v_department_key, v_requires_review
  FROM public.crm_user_context_view v
  WHERE v.tenant_id = p_tenant_id AND v.user_id = p_user_id LIMIT 1;

  SELECT p.full_name, p.email INTO v_target_name, v_target_email
  FROM public.profiles p WHERE p.id = p_user_id LIMIT 1;

  IF v_business_function IS DISTINCT FROM 'closer' THEN
    RETURN jsonb_build_object(
      'error', 'not_a_closer',
      'user', jsonb_build_object('id', p_user_id, 'name', v_target_name, 'email', v_target_email),
      'context', jsonb_build_object(
        'permission_key', v_permission_key,
        'department_key', v_department_key,
        'business_function_key', v_business_function,
        'requires_review', v_requires_review),
      'metadata', jsonb_build_object('generated_at', now(), 'source', 'closer_dashboard_v1')
    );
  END IF;

  -- Period window
  IF v_period_key = 'last_7_days' THEN
    v_start := now() - interval '7 days'; v_end := now();
  ELSIF v_period_key = 'last_30_days' THEN
    v_start := now() - interval '30 days'; v_end := now();
  ELSIF v_period_key = 'current_quarter' THEN
    v_start := date_trunc('quarter', now()); v_end := now();
  ELSIF v_period_key = 'custom' AND p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
    v_start := p_start_date::timestamptz; v_end := (p_end_date + 1)::timestamptz;
  ELSE
    v_period_key := 'current_month';
    v_start := date_trunc('month', now()); v_end := now();
  END IF;

  -- Goal
  SELECT target_value INTO v_goal
  FROM public.sales_goals
  WHERE organization_id = p_tenant_id AND user_id = p_user_id
    AND period_type = 'monthly' AND v_today BETWEEN period_start AND period_end
  ORDER BY updated_at DESC LIMIT 1;

  IF v_goal IS NULL THEN
    SELECT monthly_revenue_target INTO v_goal
    FROM public.seller_targets
    WHERE organization_id = p_tenant_id AND user_id = p_user_id
      AND date_trunc('month', period_month) = date_trunc('month', now())
    ORDER BY updated_at DESC LIMIT 1;
    IF v_goal IS NOT NULL THEN v_goal_source := 'seller_targets'; END IF;
  END IF;

  IF v_goal IS NULL THEN
    v_goal_warning := jsonb_build_object(
      'severity', 'attention',
      'audience', 'admin',
      'message', 'Meta mensal não cadastrada para este Closer. Configure em Configurações > Vendas > Metas.',
      'reason', 'no_sales_goal_or_seller_target_for_current_month'
    );
  END IF;

  -- Won/lost current month
  SELECT COALESCE(SUM(valor_previsto),0), COUNT(*) INTO v_revenue, v_won_count
  FROM public.opportunities
  WHERE organization_id = p_tenant_id AND owner_user_id = p_user_id
    AND status = 'won' AND deleted_at IS NULL
    AND closed_at >= v_start AND closed_at < v_end;

  SELECT COUNT(*) INTO v_lost_count
  FROM public.opportunities
  WHERE organization_id = p_tenant_id AND owner_user_id = p_user_id
    AND status = 'lost' AND deleted_at IS NULL
    AND closed_at >= v_start AND closed_at < v_end;

  IF v_won_count > 0 THEN v_avg_ticket := v_revenue / v_won_count; END IF;
  IF (v_won_count + v_lost_count) > 0 THEN
    v_win_rate := (v_won_count::numeric / (v_won_count + v_lost_count)) * 100;
  END IF;
  IF v_goal IS NOT NULL AND v_goal > 0 THEN
    v_attainment := (v_revenue / v_goal) * 100;
  END IF;

  -- Stalled deals via stage history (>7 days on same stage)
  CREATE TEMP TABLE IF NOT EXISTS _stalled_opps (
    opportunity_id uuid PRIMARY KEY,
    days_in_stage integer
  ) ON COMMIT DROP;
  TRUNCATE _stalled_opps;

  INSERT INTO _stalled_opps (opportunity_id, days_in_stage)
  SELECT o.id,
         EXTRACT(DAY FROM now() - COALESCE(
           (SELECT MAX(h.changed_at) FROM public.opportunity_stage_history h
              WHERE h.opportunity_id = o.id AND h.to_stage_id = o.stage_id),
           o.created_at))::int AS days_in_stage
  FROM public.opportunities o
  WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
    AND o.status IN ('new','open') AND o.deleted_at IS NULL
    AND COALESCE(
      (SELECT MAX(h.changed_at) FROM public.opportunity_stage_history h
        WHERE h.opportunity_id = o.id AND h.to_stage_id = o.stage_id),
      o.created_at) < now() - interval '7 days';

  -- KPIs
  WITH open_pipe AS (
    SELECT COALESCE(SUM(valor_previsto),0) AS val, COUNT(*) AS cnt
    FROM public.opportunities
    WHERE organization_id = p_tenant_id AND owner_user_id = p_user_id
      AND status IN ('new','open') AND deleted_at IS NULL
  ),
  prop_open AS (
    SELECT COALESCE(SUM(p.value),0) AS val, COUNT(*) AS cnt
    FROM public.proposals p JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.status IN ('sent','viewed') AND p.accepted_at IS NULL AND p.declined_at IS NULL
  ),
  prop_viewed AS (
    SELECT COUNT(*) AS cnt FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.last_viewed_at >= v_start AND p.last_viewed_at < v_end
  ),
  fup_overdue AS (
    SELECT COUNT(*) AS cnt FROM public.activities
    WHERE organization_id = p_tenant_id AND owner_user_id = p_user_id
      AND status = 'pending' AND deleted_at IS NULL AND scheduled_date < now()
  ),
  risk AS (
    SELECT COUNT(DISTINCT o.id) AS cnt FROM public.opportunities o
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND (
        (o.last_contact_date IS NULL OR o.last_contact_date < now() - interval '7 days')
        OR EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id=o.id AND p.status IN ('sent','viewed') AND p.sent_at < now() - interval '3 days')
        OR EXISTS (SELECT 1 FROM activities a WHERE a.opportunity_id=o.id AND a.status='pending' AND a.deleted_at IS NULL AND a.scheduled_date < now())
        OR COALESCE(o.prob,50) < 30
        OR EXISTS (SELECT 1 FROM _stalled_opps s WHERE s.opportunity_id=o.id)
      )
  )
  SELECT jsonb_build_object(
    'open_pipeline_value', (SELECT val FROM open_pipe),
    'open_pipeline_count', (SELECT cnt FROM open_pipe),
    'proposals_open_value', (SELECT val FROM prop_open),
    'proposals_open_count', (SELECT cnt FROM prop_open),
    'proposals_viewed_count', (SELECT cnt FROM prop_viewed),
    'overdue_followups_count', (SELECT cnt FROM fup_overdue),
    'risk_deals_count', (SELECT cnt FROM risk),
    'monthly_goal_value', v_goal,
    'monthly_revenue_value', v_revenue,
    'goal_attainment_percent', v_attainment,
    'win_rate_percent', v_win_rate,
    'won_count', v_won_count,
    'lost_count', v_lost_count,
    'average_ticket_value', v_avg_ticket
  ) INTO v_kpis;

  -- Separated lists with severity & why_here
  WITH today_agenda AS (
    SELECT jsonb_build_object(
      'id', a.id, 'kind', 'activity', 'title', a.title, 'type', a.type,
      'scheduled_date', a.scheduled_date, 'opportunity_id', a.opportunity_id,
      'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social),
      'severity', 'info',
      'why_here', 'Atividade agendada para hoje no seu calendário.'
    ) AS item, a.scheduled_date AS sort_key
    FROM public.activities a
    LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = a.account_id
    WHERE a.organization_id = p_tenant_id AND a.owner_user_id = p_user_id
      AND a.status = 'pending' AND a.deleted_at IS NULL
      AND a.scheduled_date::date = v_today
    ORDER BY a.scheduled_date ASC LIMIT 10
  ),
  overdue AS (
    SELECT jsonb_build_object(
      'id', a.id, 'kind', 'activity', 'title', a.title, 'type', a.type,
      'scheduled_date', a.scheduled_date, 'opportunity_id', a.opportunity_id,
      'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social),
      'days_overdue', EXTRACT(DAY FROM now() - a.scheduled_date)::int,
      'severity', CASE WHEN EXTRACT(DAY FROM now() - a.scheduled_date) >= 3 THEN 'critical' ELSE 'attention' END,
      'why_here', 'Atividade vencida há ' || EXTRACT(DAY FROM now() - a.scheduled_date)::int || ' dia(s) sem conclusão.'
    ) AS item
    FROM public.activities a
    LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = a.account_id
    WHERE a.organization_id = p_tenant_id AND a.owner_user_id = p_user_id
      AND a.status = 'pending' AND a.deleted_at IS NULL AND a.scheduled_date < now()
    ORDER BY a.scheduled_date ASC LIMIT 10
  ),
  prop_expiring_today AS (
    SELECT jsonb_build_object(
      'id', p.id, 'kind', 'proposal', 'title', p.title, 'value', p.value,
      'expires_at', p.expires_at, 'opportunity_id', p.opportunity_id,
      'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name),
      'severity', 'critical',
      'why_here', 'Proposta com prazo final hoje.'
    ) AS item
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at::date = v_today AND p.status IN ('sent','viewed')
      AND p.accepted_at IS NULL AND p.declined_at IS NULL
    ORDER BY p.expires_at ASC LIMIT 10
  ),
  prop_expiring_48 AS (
    SELECT jsonb_build_object(
      'id', p.id, 'kind', 'proposal', 'title', p.title, 'value', p.value,
      'expires_at', p.expires_at, 'opportunity_id', p.opportunity_id,
      'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name),
      'severity', 'attention',
      'why_here', 'Proposta vence nas próximas 48 horas.'
    ) AS item
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at > now() AND p.expires_at <= now() + interval '48 hours'
      AND p.expires_at::date <> v_today
      AND p.status IN ('sent','viewed') AND p.accepted_at IS NULL AND p.declined_at IS NULL
    ORDER BY p.expires_at ASC LIMIT 10
  ),
  prop_expired AS (
    SELECT jsonb_build_object(
      'id', p.id, 'kind', 'proposal', 'title', p.title, 'value', p.value,
      'expires_at', p.expires_at, 'opportunity_id', p.opportunity_id,
      'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name),
      'severity', 'critical',
      'why_here', 'Proposta vencida sem aceite. Renegocie o prazo.'
    ) AS item
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at IS NOT NULL AND p.expires_at < now()
      AND p.status IN ('sent','viewed') AND p.accepted_at IS NULL AND p.declined_at IS NULL
    ORDER BY p.expires_at DESC LIMIT 10
  ),
  prop_viewed_no_fup AS (
    SELECT jsonb_build_object(
      'id', p.id, 'kind', 'proposal', 'title', p.title, 'value', p.value,
      'last_viewed_at', p.last_viewed_at, 'opportunity_id', p.opportunity_id,
      'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name),
      'severity', 'opportunity',
      'why_here', 'Cliente visualizou a proposta e não há atividade posterior. Acionar agora.'
    ) AS item
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.last_viewed_at IS NOT NULL
      AND p.status IN ('sent','viewed')
      AND NOT EXISTS (
        SELECT 1 FROM activities a WHERE a.opportunity_id = o.id
          AND a.created_at > p.last_viewed_at AND a.deleted_at IS NULL
      )
    ORDER BY p.last_viewed_at DESC LIMIT 10
  ),
  no_next_activity AS (
    SELECT jsonb_build_object(
      'id', o.id, 'kind', 'opportunity', 'title', o.title, 'value', o.valor_previsto,
      'opportunity_id', o.id, 'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social),
      'severity', CASE WHEN COALESCE(o.valor_previsto,0) >= 10000 THEN 'attention' ELSE 'info' END,
      'why_here', 'Oportunidade aberta sem nenhuma atividade futura agendada.'
    ) AS item
    FROM public.opportunities o
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM activities a WHERE a.opportunity_id = o.id
          AND a.status = 'pending' AND a.deleted_at IS NULL AND a.scheduled_date >= now()
      )
    ORDER BY o.valor_previsto DESC NULLS LAST LIMIT 10
  ),
  stalled AS (
    SELECT jsonb_build_object(
      'id', o.id, 'kind', 'opportunity', 'title', o.title, 'value', o.valor_previsto,
      'opportunity_id', o.id, 'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social),
      'stage_name', s.name, 'days_in_stage', st.days_in_stage,
      'severity', CASE WHEN st.days_in_stage >= 14 THEN 'critical' ELSE 'attention' END,
      'why_here', 'Parado há ' || st.days_in_stage || ' dia(s) na mesma etapa (' || COALESCE(s.name,'sem etapa') || ').'
    ) AS item
    FROM _stalled_opps st
    JOIN public.opportunities o ON o.id = st.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    LEFT JOIN public.stages s ON s.id = o.stage_id
    ORDER BY st.days_in_stage DESC LIMIT 10
  ),
  risk_deals AS (
    SELECT jsonb_build_object(
      'id', o.id, 'kind', 'opportunity', 'title', o.title, 'value', o.valor_previsto,
      'opportunity_id', o.id, 'stage_name', s.name,
      'customer_name', COALESCE(ac.nome_fantasia, ac.razao_social),
      'last_contact_date', o.last_contact_date,
      'severity', CASE WHEN COALESCE(o.prob,50) < 30 OR COALESCE(o.valor_previsto,0) >= 50000 THEN 'critical' ELSE 'attention' END,
      'risk_reason',
        CASE
          WHEN COALESCE(o.prob,50) < 30 THEN 'Probabilidade abaixo de 30%'
          WHEN o.last_contact_date IS NULL OR o.last_contact_date < now() - interval '7 days' THEN 'Sem contato há mais de 7 dias'
          WHEN EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id=o.id AND p.status IN ('sent','viewed') AND p.sent_at < now() - interval '3 days') THEN 'Proposta sem resposta há mais de 3 dias'
          WHEN EXISTS (SELECT 1 FROM _stalled_opps s2 WHERE s2.opportunity_id=o.id) THEN 'Parado há mais de 7 dias na mesma etapa'
          ELSE 'Follow up vencido'
        END,
      'why_here', 'Oportunidade exibe ao menos um sinal de risco comercial.'
    ) AS item, o.valor_previsto AS sort_key
    FROM public.opportunities o
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    LEFT JOIN public.stages s ON s.id = o.stage_id
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND (
        (o.last_contact_date IS NULL OR o.last_contact_date < now() - interval '7 days')
        OR EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id=o.id AND p.status IN ('sent','viewed') AND p.sent_at < now() - interval '3 days')
        OR EXISTS (SELECT 1 FROM activities a WHERE a.opportunity_id=o.id AND a.status='pending' AND a.deleted_at IS NULL AND a.scheduled_date < now())
        OR COALESCE(o.prob,50) < 30
        OR EXISTS (SELECT 1 FROM _stalled_opps s2 WHERE s2.opportunity_id=o.id)
      )
    ORDER BY o.valor_previsto DESC NULLS LAST LIMIT 10
  )
  SELECT jsonb_build_object(
    'today_agenda', COALESCE((SELECT jsonb_agg(item ORDER BY sort_key) FROM today_agenda), '[]'::jsonb),
    'overdue_followups', COALESCE((SELECT jsonb_agg(item) FROM overdue), '[]'::jsonb),
    'proposals_expiring_today', COALESCE((SELECT jsonb_agg(item) FROM prop_expiring_today), '[]'::jsonb),
    'proposals_expiring_48h', COALESCE((SELECT jsonb_agg(item) FROM prop_expiring_48), '[]'::jsonb),
    'proposals_expired', COALESCE((SELECT jsonb_agg(item) FROM prop_expired), '[]'::jsonb),
    'proposals_viewed_no_followup', COALESCE((SELECT jsonb_agg(item) FROM prop_viewed_no_fup), '[]'::jsonb),
    'opportunities_without_next_activity', COALESCE((SELECT jsonb_agg(item) FROM no_next_activity), '[]'::jsonb),
    'stalled_opportunities', COALESCE((SELECT jsonb_agg(item) FROM stalled), '[]'::jsonb),
    'risk_deals', COALESCE((SELECT jsonb_agg(item ORDER BY sort_key DESC NULLS LAST) FROM risk_deals), '[]'::jsonb)
  ) INTO v_lists;

  -- Top 10 ações do dia (ranking)
  WITH ranked AS (
    SELECT 1 AS priority, 'critical' AS severity, 'proposal_viewed_no_followup' AS type,
           'Proposta visualizada sem follow up' AS title,
           'Acionar cliente em até 15 minutos' AS action_label,
           p.id AS proposal_id, p.opportunity_id,
           COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name) AS customer_name,
           p.value AS value,
           'Cliente abriu sua proposta hoje e ninguém deu sequência.' AS why_here
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.last_viewed_at IS NOT NULL AND p.last_viewed_at::date = v_today
      AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.opportunity_id=o.id AND a.created_at > p.last_viewed_at AND a.deleted_at IS NULL)
    UNION ALL
    SELECT 2, 'critical', 'proposal_expiring_today', 'Proposta vence hoje', 'Enviar reforço de fechamento',
           p.id, p.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name), p.value,
           'Validade da proposta termina hoje.'
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at::date = v_today AND p.status IN ('sent','viewed')
    UNION ALL
    SELECT 3, 'attention', 'overdue_followup', 'Follow up vencido', 'Executar follow up agora',
           NULL::uuid, a.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social), o.valor_previsto,
           'Atividade agendada já passou da data prevista.'
    FROM public.activities a
    LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = a.account_id
    WHERE a.organization_id = p_tenant_id AND a.owner_user_id = p_user_id
      AND a.status = 'pending' AND a.deleted_at IS NULL AND a.scheduled_date < now()
    UNION ALL
    SELECT 4, 'critical', 'proposal_expired', 'Proposta vencida', 'Renegociar prazo',
           p.id, p.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name), p.value,
           'Proposta passou da validade sem aceite.'
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at IS NOT NULL AND p.expires_at::date < v_today
      AND p.status IN ('sent','viewed') AND p.accepted_at IS NULL AND p.declined_at IS NULL
    UNION ALL
    SELECT 5, 'attention', 'high_value_no_next_activity', 'Deal de alto valor sem próxima atividade', 'Agendar call de decisão',
           NULL::uuid, o.id, COALESCE(ac.nome_fantasia, ac.razao_social), o.valor_previsto,
           'Oportunidade acima de R$ 10k sem atividade futura.'
    FROM public.opportunities o
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND COALESCE(o.valor_previsto,0) >= 10000
      AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.opportunity_id=o.id AND a.status='pending' AND a.deleted_at IS NULL AND a.scheduled_date >= now())
    UNION ALL
    SELECT 6, 'attention', 'stalled_deal', 'Deal parado há mais de 7 dias', 'Movimentar etapa ou contatar',
           NULL::uuid, st.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social), o.valor_previsto,
           'Sem mudança de etapa há ' || st.days_in_stage || ' dia(s).'
    FROM _stalled_opps st
    JOIN public.opportunities o ON o.id = st.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    UNION ALL
    SELECT 7, 'attention', 'proposal_expiring_48h', 'Proposta vence em 48h', 'Confirmar fechamento',
           p.id, p.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name), p.value,
           'Janela curta para fechamento.'
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at > now() AND p.expires_at <= now() + interval '48 hours'
      AND p.expires_at::date <> v_today AND p.status IN ('sent','viewed')
  )
  SELECT jsonb_build_object(
    'top_actions_today', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.priority, r.value DESC NULLS LAST)
      FROM (SELECT * FROM ranked LIMIT 10) r
    ), '[]'::jsonb)
  ) INTO v_central;

  v_lists := v_lists || v_central;

  -- Central counts (recompute from lists for consistency)
  v_central := jsonb_build_object(
    'today_activities_count', jsonb_array_length(v_lists->'today_agenda'),
    'overdue_followups_count', (v_kpis->>'overdue_followups_count')::int,
    'proposals_expiring_today', jsonb_array_length(v_lists->'proposals_expiring_today'),
    'proposals_expiring_48h', jsonb_array_length(v_lists->'proposals_expiring_48h'),
    'proposals_expired', jsonb_array_length(v_lists->'proposals_expired'),
    'proposals_viewed_no_followup', jsonb_array_length(v_lists->'proposals_viewed_no_followup'),
    'opportunities_without_next_activity', jsonb_array_length(v_lists->'opportunities_without_next_activity'),
    'stalled_opportunities', jsonb_array_length(v_lists->'stalled_opportunities')
  );

  v_availability := jsonb_build_object(
    'pipeline','ready','proposals','ready','proposal_views','ready',
    'goals', CASE WHEN v_goal IS NULL THEN 'unavailable' ELSE 'ready' END,
    'win_rate','ready','ticket','ready','followups','ready',
    'stalled', 'ready'
  );

  -- Lightweight audit (only when admin previewing someone else)
  IF v_caller_is_admin AND v_caller <> p_user_id THEN
    BEGIN
      INSERT INTO public.crm_closer_dashboard_views (tenant_id, viewer_user_id, target_user_id, source)
      VALUES (p_tenant_id, v_caller, p_user_id, 'preview');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'user', jsonb_build_object('id', p_user_id, 'name', v_target_name, 'email', v_target_email),
    'context', jsonb_build_object(
      'permission_key', v_permission_key, 'department_key', v_department_key,
      'business_function_key', v_business_function, 'requires_review', v_requires_review),
    'period', jsonb_build_object('key', v_period_key, 'start_date', v_start, 'end_date', v_end),
    'kpis', v_kpis,
    'central_do_dia', v_central,
    'lists', v_lists,
    'availability', v_availability,
    'goal_warning', v_goal_warning,
    'metadata', jsonb_build_object(
      'generated_at', now(), 'source', 'closer_dashboard_v1.1',
      'goal_source', v_goal_source, 'warnings', '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_get_closer_dashboard_data(uuid, uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_get_closer_dashboard_data(uuid, uuid, text, date, date) TO authenticated;