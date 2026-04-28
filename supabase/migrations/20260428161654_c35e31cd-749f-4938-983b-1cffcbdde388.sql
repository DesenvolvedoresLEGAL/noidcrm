-- Sprint 6: Dashboard Closer Real v1 - consolidated RPC
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
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_kpis jsonb;
  v_central jsonb;
  v_lists jsonb;
  v_availability jsonb;
  v_goal numeric;
  v_goal_source text := 'sales_goals';
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

  -- Caller belongs to tenant
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_tenant_id
      AND om.user_id = v_caller
      AND COALESCE(om.is_active, true) = true
  ) INTO v_caller_in_tenant;
  IF NOT v_caller_in_tenant THEN
    RAISE EXCEPTION 'forbidden_tenant' USING ERRCODE = '42501';
  END IF;

  -- Caller admin/owner?
  BEGIN
    v_caller_is_admin := public.user_is_org_admin(p_tenant_id);
  EXCEPTION WHEN OTHERS THEN
    v_caller_is_admin := false;
  END;
  IF NOT v_caller_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = p_tenant_id
        AND om.user_id = v_caller
        AND om.role IN ('owner','admin')
    ) INTO v_caller_is_admin;
  END IF;

  IF v_caller <> p_user_id AND NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'forbidden_target' USING ERRCODE = '42501';
  END IF;

  -- Target belongs to tenant
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_tenant_id
      AND om.user_id = p_user_id
  ) INTO v_target_in_tenant;
  IF NOT v_target_in_tenant THEN
    RAISE EXCEPTION 'target_not_in_tenant' USING ERRCODE = '42501';
  END IF;

  -- Resolve context (closer or not)
  SELECT v.business_function_key, v.permission_key, v.department_key, COALESCE(v.requires_review,false)
    INTO v_business_function, v_permission_key, v_department_key, v_requires_review
  FROM public.crm_user_context_view v
  WHERE v.tenant_id = p_tenant_id AND v.user_id = p_user_id
  LIMIT 1;

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
        'requires_review', v_requires_review
      ),
      'metadata', jsonb_build_object('generated_at', now(), 'source', 'closer_dashboard_v1')
    );
  END IF;

  -- Resolve period window
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

  v_month_start := date_trunc('month', now());
  v_month_end := (date_trunc('month', now()) + interval '1 month');

  -- Goal (current month)
  SELECT target_value INTO v_goal
  FROM public.sales_goals
  WHERE organization_id = p_tenant_id
    AND user_id = p_user_id
    AND period_type = 'monthly'
    AND v_today BETWEEN period_start AND period_end
  ORDER BY updated_at DESC LIMIT 1;

  IF v_goal IS NULL THEN
    SELECT monthly_revenue_target INTO v_goal
    FROM public.seller_targets
    WHERE organization_id = p_tenant_id
      AND user_id = p_user_id
      AND date_trunc('month', period_month) = date_trunc('month', now())
    ORDER BY updated_at DESC LIMIT 1;
    IF v_goal IS NOT NULL THEN v_goal_source := 'seller_targets'; END IF;
  END IF;

  -- Revenue current month (won)
  SELECT COALESCE(SUM(valor_previsto),0), COUNT(*)
    INTO v_revenue, v_won_count
  FROM public.opportunities
  WHERE organization_id = p_tenant_id
    AND owner_user_id = p_user_id
    AND status = 'won'
    AND deleted_at IS NULL
    AND closed_at >= v_start AND closed_at < v_end;

  SELECT COUNT(*) INTO v_lost_count
  FROM public.opportunities
  WHERE organization_id = p_tenant_id
    AND owner_user_id = p_user_id
    AND status = 'lost'
    AND deleted_at IS NULL
    AND closed_at >= v_start AND closed_at < v_end;

  IF v_won_count > 0 THEN v_avg_ticket := v_revenue / v_won_count; END IF;
  IF (v_won_count + v_lost_count) > 0 THEN
    v_win_rate := (v_won_count::numeric / (v_won_count + v_lost_count)) * 100;
  END IF;
  IF v_goal IS NOT NULL AND v_goal > 0 THEN
    v_attainment := (v_revenue / v_goal) * 100;
  END IF;

  -- KPIs aggregate
  WITH open_pipe AS (
    SELECT COALESCE(SUM(valor_previsto),0) AS val, COUNT(*) AS cnt
    FROM public.opportunities
    WHERE organization_id = p_tenant_id AND owner_user_id = p_user_id
      AND status IN ('new','open') AND deleted_at IS NULL
  ),
  prop_open AS (
    SELECT COALESCE(SUM(p.value),0) AS val, COUNT(*) AS cnt
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id
      AND o.owner_user_id = p_user_id
      AND p.status IN ('sent','viewed')
      AND p.accepted_at IS NULL AND p.declined_at IS NULL
  ),
  prop_viewed AS (
    SELECT COUNT(*) AS cnt
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id
      AND o.owner_user_id = p_user_id
      AND p.last_viewed_at >= v_start AND p.last_viewed_at < v_end
  ),
  fup_overdue AS (
    SELECT COUNT(*) AS cnt
    FROM public.activities
    WHERE organization_id = p_tenant_id AND owner_user_id = p_user_id
      AND status = 'pending' AND deleted_at IS NULL
      AND scheduled_date < now()
  ),
  risk AS (
    SELECT COUNT(*) AS cnt FROM (
      SELECT o.id FROM public.opportunities o
      WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
        AND o.status IN ('new','open') AND o.deleted_at IS NULL
        AND (
          (o.last_contact_date IS NULL OR o.last_contact_date < now() - interval '7 days')
          OR EXISTS (
            SELECT 1 FROM public.proposals p
            WHERE p.opportunity_id = o.id AND p.status IN ('sent','viewed')
              AND p.sent_at < now() - interval '3 days'
          )
          OR EXISTS (
            SELECT 1 FROM public.activities a
            WHERE a.opportunity_id = o.id AND a.status = 'pending' AND a.deleted_at IS NULL
              AND a.scheduled_date < now()
          )
          OR COALESCE(o.prob,50) < 30
        )
    ) s
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

  -- Lists
  WITH risk_deals AS (
    SELECT o.id, o.title, o.valor_previsto, o.last_contact_date, o.stage_id,
           s.name AS stage_name, a.nome_fantasia, a.razao_social,
           CASE
             WHEN COALESCE(o.prob,50) < 30 THEN 'Baixa probabilidade'
             WHEN o.last_contact_date IS NULL OR o.last_contact_date < now() - interval '7 days' THEN 'Sem contato há mais de 7 dias'
             WHEN EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id=o.id AND p.status IN ('sent','viewed') AND p.sent_at < now() - interval '3 days') THEN 'Proposta sem resposta há mais de 3 dias'
             ELSE 'Follow up vencido'
           END AS risk_reason
    FROM public.opportunities o
    LEFT JOIN public.stages s ON s.id = o.stage_id
    LEFT JOIN public.accounts a ON a.id = o.account_id
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND (
        (o.last_contact_date IS NULL OR o.last_contact_date < now() - interval '7 days')
        OR EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id=o.id AND p.status IN ('sent','viewed') AND p.sent_at < now() - interval '3 days')
        OR EXISTS (SELECT 1 FROM activities a2 WHERE a2.opportunity_id=o.id AND a2.status='pending' AND a2.deleted_at IS NULL AND a2.scheduled_date < now())
        OR COALESCE(o.prob,50) < 30
      )
    ORDER BY o.valor_previsto DESC NULLS LAST
    LIMIT 10
  ),
  overdue AS (
    SELECT a.id, a.title, a.scheduled_date, a.type, a.opportunity_id,
           o.title AS deal_title, COALESCE(ac.nome_fantasia, ac.razao_social) AS customer_name,
           EXTRACT(DAY FROM now() - a.scheduled_date)::int AS days_overdue
    FROM public.activities a
    LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = a.account_id
    WHERE a.organization_id = p_tenant_id AND a.owner_user_id = p_user_id
      AND a.status = 'pending' AND a.deleted_at IS NULL
      AND a.scheduled_date < now()
    ORDER BY a.scheduled_date ASC
    LIMIT 10
  ),
  viewed_props AS (
    SELECT p.id, p.title, p.value, p.last_viewed_at, p.views_count,
           p.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name) AS customer_name
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id
      AND o.owner_user_id = p_user_id
      AND p.last_viewed_at >= v_start AND p.last_viewed_at < v_end
    ORDER BY p.last_viewed_at DESC
    LIMIT 10
  ),
  proposals_action AS (
    SELECT p.id, p.title, p.value, p.status, p.expires_at, p.last_viewed_at,
           p.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name) AS customer_name,
           CASE
             WHEN p.expires_at IS NOT NULL AND p.expires_at::date < v_today THEN 'Proposta vencida'
             WHEN p.expires_at IS NOT NULL AND p.expires_at::date = v_today THEN 'Vence hoje'
             WHEN p.expires_at IS NOT NULL AND p.expires_at <= now() + interval '48 hours' THEN 'Vence em 48h'
             WHEN p.last_viewed_at IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM activities a3 WHERE a3.opportunity_id = p.opportunity_id
                  AND a3.created_at > p.last_viewed_at AND a3.deleted_at IS NULL
             ) THEN 'Visualizada sem follow up'
             ELSE 'Atenção'
           END AS reason
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id
      AND o.owner_user_id = p_user_id
      AND p.status IN ('sent','viewed')
      AND p.accepted_at IS NULL AND p.declined_at IS NULL
      AND (
        (p.expires_at IS NOT NULL AND p.expires_at <= now() + interval '48 hours')
        OR p.last_viewed_at IS NOT NULL
      )
    ORDER BY COALESCE(p.expires_at, p.last_viewed_at) ASC NULLS LAST
    LIMIT 10
  ),
  today_agenda AS (
    SELECT a.id, a.title, a.type, a.scheduled_date, a.opportunity_id,
           COALESCE(ac.nome_fantasia, ac.razao_social) AS customer_name
    FROM public.activities a
    LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = a.account_id
    WHERE a.organization_id = p_tenant_id AND a.owner_user_id = p_user_id
      AND a.status = 'pending' AND a.deleted_at IS NULL
      AND a.scheduled_date::date = v_today
    ORDER BY a.scheduled_date ASC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'risk_deals', COALESCE((SELECT jsonb_agg(to_jsonb(rd)) FROM risk_deals rd), '[]'::jsonb),
    'overdue_followups', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM overdue o), '[]'::jsonb),
    'viewed_proposals', COALESCE((SELECT jsonb_agg(to_jsonb(v)) FROM viewed_props v), '[]'::jsonb),
    'proposals_action_required', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM proposals_action p), '[]'::jsonb),
    'today_agenda', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM today_agenda t), '[]'::jsonb)
  ) INTO v_lists;

  -- Next actions (deterministic)
  WITH ranked AS (
    SELECT 1 AS priority, 'proposal_viewed_no_followup' AS type,
           'Proposta visualizada sem follow up' AS title,
           'Ligar ou enviar WhatsApp em até 15 minutos' AS action_label,
           p.id AS proposal_id, p.opportunity_id,
           COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name) AS customer_name,
           p.value AS value
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.last_viewed_at IS NOT NULL AND p.last_viewed_at::date = v_today
      AND NOT EXISTS (SELECT 1 FROM activities a4 WHERE a4.opportunity_id=o.id AND a4.created_at > p.last_viewed_at AND a4.deleted_at IS NULL)
    UNION ALL
    SELECT 2, 'proposal_expiring_today', 'Proposta vence hoje', 'Enviar reforço de fechamento',
           p.id, p.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name), p.value
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at::date = v_today AND p.status IN ('sent','viewed')
    UNION ALL
    SELECT 3, 'overdue_followup', 'Follow up vencido', 'Executar follow up agora',
           NULL::uuid, a.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social), o.valor_previsto
    FROM public.activities a
    LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = a.account_id
    WHERE a.organization_id = p_tenant_id AND a.owner_user_id = p_user_id
      AND a.status = 'pending' AND a.deleted_at IS NULL AND a.scheduled_date < now()
    UNION ALL
    SELECT 4, 'proposal_expired', 'Proposta vencida', 'Renegociar prazo',
           p.id, p.opportunity_id, COALESCE(ac.nome_fantasia, ac.razao_social, p.client_name), p.value
    FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at IS NOT NULL AND p.expires_at::date < v_today
      AND p.status IN ('sent','viewed') AND p.accepted_at IS NULL AND p.declined_at IS NULL
    UNION ALL
    SELECT 5, 'high_value_no_next_activity', 'Deal de alto valor sem próxima atividade', 'Agendar call de decisão',
           NULL::uuid, o.id, COALESCE(ac.nome_fantasia, ac.razao_social), o.valor_previsto
    FROM public.opportunities o
    LEFT JOIN public.accounts ac ON ac.id = o.account_id
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND COALESCE(o.valor_previsto,0) >= 10000
      AND NOT EXISTS (SELECT 1 FROM activities a5 WHERE a5.opportunity_id=o.id AND a5.status='pending' AND a5.deleted_at IS NULL AND a5.scheduled_date >= now())
  )
  SELECT jsonb_build_object(
    'next_actions', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.priority, r.value DESC NULLS LAST)
      FROM (SELECT * FROM ranked LIMIT 10) r
    ), '[]'::jsonb)
  ) INTO v_central;

  v_lists := v_lists || v_central;

  -- Central do Dia counts
  WITH today_acts AS (
    SELECT COUNT(*) AS cnt FROM public.activities
    WHERE organization_id = p_tenant_id AND owner_user_id = p_user_id
      AND status = 'pending' AND deleted_at IS NULL AND scheduled_date::date = v_today
  ),
  prop_today AS (
    SELECT COUNT(*) AS cnt FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at::date = v_today AND p.status IN ('sent','viewed')
  ),
  prop_48 AS (
    SELECT COUNT(*) AS cnt FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at > now() AND p.expires_at <= now() + interval '48 hours'
      AND p.status IN ('sent','viewed')
  ),
  prop_expired AS (
    SELECT COUNT(*) AS cnt FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.expires_at IS NOT NULL AND p.expires_at < now()
      AND p.status IN ('sent','viewed') AND p.accepted_at IS NULL AND p.declined_at IS NULL
  ),
  prop_view_no_fup AS (
    SELECT COUNT(*) AS cnt FROM public.proposals p
    JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND p.last_viewed_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM activities a6 WHERE a6.opportunity_id=o.id AND a6.created_at > p.last_viewed_at AND a6.deleted_at IS NULL)
  ),
  no_next AS (
    SELECT COUNT(*) AS cnt FROM public.opportunities o
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM activities a7 WHERE a7.opportunity_id=o.id AND a7.status='pending' AND a7.deleted_at IS NULL AND a7.scheduled_date >= now())
  ),
  stalled AS (
    SELECT COUNT(*) AS cnt FROM public.opportunities o
    WHERE o.organization_id = p_tenant_id AND o.owner_user_id = p_user_id
      AND o.status IN ('new','open') AND o.deleted_at IS NULL
      AND o.updated_at < now() - interval '7 days'
  )
  SELECT jsonb_build_object(
    'today_activities_count', (SELECT cnt FROM today_acts),
    'overdue_followups_count', (v_kpis->>'overdue_followups_count')::int,
    'proposals_expiring_today', (SELECT cnt FROM prop_today),
    'proposals_expiring_48h', (SELECT cnt FROM prop_48),
    'proposals_expired', (SELECT cnt FROM prop_expired),
    'proposals_viewed_no_followup', (SELECT cnt FROM prop_view_no_fup),
    'opportunities_without_next_activity', (SELECT cnt FROM no_next),
    'stalled_opportunities', (SELECT cnt FROM stalled)
  ) INTO v_central;

  v_availability := jsonb_build_object(
    'pipeline','ready','proposals','ready','proposal_views','ready',
    'goals', CASE WHEN v_goal IS NULL THEN 'unavailable' ELSE 'ready' END,
    'win_rate','ready','ticket','ready','followups','ready'
  );

  RETURN jsonb_build_object(
    'user', jsonb_build_object('id', p_user_id, 'name', v_target_name, 'email', v_target_email),
    'context', jsonb_build_object(
      'permission_key', v_permission_key,
      'department_key', v_department_key,
      'business_function_key', v_business_function,
      'requires_review', v_requires_review
    ),
    'period', jsonb_build_object(
      'key', v_period_key,
      'start_date', v_start,
      'end_date', v_end
    ),
    'kpis', v_kpis,
    'central_do_dia', v_central,
    'lists', v_lists,
    'availability', v_availability,
    'metadata', jsonb_build_object(
      'generated_at', now(),
      'source', 'closer_dashboard_v1',
      'goal_source', v_goal_source,
      'warnings', '[]'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_get_closer_dashboard_data(uuid, uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_get_closer_dashboard_data(uuid, uuid, text, date, date) TO authenticated;