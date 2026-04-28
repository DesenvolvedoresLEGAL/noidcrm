
-- =====================================================================
-- Sprint 4.1.1: Backfill + auto-seed dashboard profiles per organization
-- =====================================================================

-- 1) Function that seeds the 17 default placeholder profiles for a tenant
CREATE OR REPLACE FUNCTION public.crm_seed_default_dashboard_profiles(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH seeds(scope_type, scope_key, key, name, description, widgets, metadata) AS (
    VALUES
      -- default
      ('default','default','dashboard_legacy_default','Dashboard Legacy (padrão)',
        'Dashboard padrão atual do NOID. Fallback final do resolver.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true,'is_legacy',true)),

      -- permission_role
      ('permission_role','owner','dashboard_owner_placeholder','Cockpit Executivo (Owner)',
        'Dashboard cockpit do Owner. Resolução prioritária para usuários Owner.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true,'is_owner_cockpit',true)),
      ('permission_role','admin','dashboard_admin_placeholder','Admin Center',
        'Área de gestão e configuração do CRM. Permissão Admin libera gestão do CRM, mas o dashboard principal segue a função/área do usuário.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true,'is_admin_center',true,'not_a_home_dashboard',true)),
      ('permission_role','manager','dashboard_manager_placeholder','Dashboard Gestor',
        'Dashboard padrão para usuários Manager.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('permission_role','user','dashboard_user_placeholder','Dashboard Usuário',
        'Dashboard padrão para usuários comuns.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),

      -- department
      ('department','finance','dashboard_finance_placeholder','Dashboard Financeiro',
        'Visão financeira da área.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('department','operations','dashboard_operations_placeholder','Dashboard Operações',
        'Visão de operações da área.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),

      -- business_function
      ('business_function','sdr','dashboard_pre_sales_sdr_placeholder','Dashboard SDR',
        'Visão de pré-vendas para SDRs.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','closer','dashboard_sales_closer_placeholder','Dashboard Closer',
        'Visão de vendas para Closers.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','cs','dashboard_cs_placeholder','Dashboard CS',
        'Visão de Customer Success.',
        '[]'::jsonb,
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','owner','dashboard_function_owner_placeholder','Cockpit Executivo (Owner)',
        'Visão executiva do negócio para fundadores e sócios.',
        jsonb_build_array(
          jsonb_build_object('id','exec_revenue','title','Receita consolidada','type','placeholder'),
          jsonb_build_object('id','exec_pipeline','title','Pipeline saúde','type','placeholder'),
          jsonb_build_object('id','exec_team','title','Time e produtividade','type','placeholder')
        ),
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','director','dashboard_function_director_placeholder','Cockpit Diretoria',
        'Visão estratégica para diretores e líderes de área.',
        jsonb_build_array(
          jsonb_build_object('id','dir_kpis','title','KPIs por área','type','placeholder'),
          jsonb_build_object('id','dir_forecast','title','Forecast consolidado','type','placeholder')
        ),
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','finance_admin','dashboard_function_finance_admin_placeholder','Operação Financeira',
        'Visão de operação financeira: faturamento, contratos, recebíveis.',
        jsonb_build_array(
          jsonb_build_object('id','fin_billing','title','Faturamento','type','placeholder'),
          jsonb_build_object('id','fin_contracts','title','Contratos ativos','type','placeholder')
        ),
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','operations','dashboard_function_operations_placeholder','Operações',
        'Visão de operação interna e processos.',
        jsonb_build_array(
          jsonb_build_object('id','ops_tasks','title','Tarefas operacionais','type','placeholder'),
          jsonb_build_object('id','ops_sla','title','SLA de processos','type','placeholder')
        ),
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','technical_support','dashboard_function_technical_support_placeholder','Suporte Técnico',
        'Visão de fila de tickets, SLAs e satisfação.',
        jsonb_build_array(
          jsonb_build_object('id','sup_tickets','title','Tickets abertos','type','placeholder'),
          jsonb_build_object('id','sup_csat','title','Satisfação','type','placeholder')
        ),
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','dev','dashboard_function_dev_placeholder','Engenharia',
        'Visão de entregas, deploys e backlog técnico.',
        jsonb_build_array(
          jsonb_build_object('id','dev_releases','title','Releases','type','placeholder'),
          jsonb_build_object('id','dev_backlog','title','Backlog técnico','type','placeholder')
        ),
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true)),
      ('business_function','automation','dashboard_function_automation_placeholder','Automação / RevOps',
        'Visão de automações, workflows e agentes.',
        jsonb_build_array(
          jsonb_build_object('id','auto_workflows','title','Workflows ativos','type','placeholder'),
          jsonb_build_object('id','auto_agents','title','Agentes IA','type','placeholder')
        ),
        jsonb_build_object('seed_sprint','sprint_4_backfill','placeholder',true))
  )
  INSERT INTO public.crm_dashboard_profiles (
    tenant_id, key, name, description, scope_type, scope_key,
    layout, widgets, filters, permissions, metadata, is_system, is_active
  )
  SELECT
    p_tenant_id,
    s.key,
    s.name,
    s.description,
    s.scope_type,
    s.scope_key,
    jsonb_build_object('type','placeholder','columns',2),
    s.widgets,
    '{}'::jsonb,
    '{}'::jsonb,
    s.metadata,
    true,
    true
  FROM seeds s
  ON CONFLICT (tenant_id, scope_type, scope_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- 2) Backfill: seed all organizations that have fewer than 17 profiles
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT o.id
    FROM public.organizations o
    LEFT JOIN public.crm_dashboard_profiles dp ON dp.tenant_id = o.id
    GROUP BY o.id
    HAVING count(dp.id) < 17
  LOOP
    PERFORM public.crm_seed_default_dashboard_profiles(r.id);
  END LOOP;
END $$;

-- 3) Trigger: auto-seed for any new organization
CREATE OR REPLACE FUNCTION public.trg_auto_seed_dashboard_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.crm_seed_default_dashboard_profiles(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block organization creation if seeding fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_auto_seed_dashboard_profiles ON public.organizations;
CREATE TRIGGER trg_organizations_auto_seed_dashboard_profiles
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_seed_dashboard_profiles();
