
-- decision_rules
CREATE TABLE IF NOT EXISTS public.decision_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  min_score INTEGER,
  max_score INTEGER,
  min_confidence INTEGER,
  min_contact_score INTEGER,
  action_create_opportunity BOOLEAN NOT NULL DEFAULT false,
  action_create_task BOOLEAN NOT NULL DEFAULT false,
  action_assign_owner BOOLEAN NOT NULL DEFAULT false,
  action_enroll_sequence BOOLEAN NOT NULL DEFAULT false,
  pipeline_id TEXT,
  stage_id TEXT,
  sequence_id UUID,
  owner_strategy TEXT CHECK (owner_strategy IN ('round_robin','fixed','territory')),
  fixed_owner_user_id UUID,
  owner_role_filter TEXT,
  priority_label TEXT CHECK (priority_label IN ('hot','warm','cold')),
  task_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_rules_org_active
  ON public.decision_rules(organization_id, is_active, priority);

ALTER TABLE public.decision_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decision_rules_select_org" ON public.decision_rules
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "decision_rules_insert_org" ON public.decision_rules
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "decision_rules_update_org" ON public.decision_rules
  FOR UPDATE USING (organization_id = public.get_user_organization_id());
CREATE POLICY "decision_rules_delete_org" ON public.decision_rules
  FOR DELETE USING (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_decision_rules_updated_at
  BEFORE UPDATE ON public.decision_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- decision_logs
CREATE TABLE IF NOT EXISTS public.decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  prospect_id UUID,
  enrichment_run_id UUID,
  rule_id UUID,
  score INTEGER,
  confidence INTEGER,
  quality_label TEXT,
  decision_taken TEXT NOT NULL CHECK (decision_taken IN (
    'executed','skipped_no_rule','skipped_duplicate',
    'skipped_low_quality','skipped_already_processed','failed'
  )),
  actions_executed JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_logs_prospect ON public.decision_logs(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_logs_run ON public.decision_logs(enrichment_run_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_org_created ON public.decision_logs(organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_logs_executed_per_run
  ON public.decision_logs(prospect_id, enrichment_run_id)
  WHERE decision_taken = 'executed';

ALTER TABLE public.decision_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decision_logs_select_org" ON public.decision_logs
  FOR SELECT USING (organization_id = public.get_user_organization_id());

-- outbound_tasks
CREATE TABLE IF NOT EXISTS public.outbound_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  prospect_id UUID,
  account_id UUID,
  opportunity_id UUID,
  owner_user_id UUID,
  decision_log_id UUID,
  task_type TEXT NOT NULL CHECK (task_type IN ('email','whatsapp','call')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','scheduled','sent','failed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_tasks_owner ON public.outbound_tasks(owner_user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_outbound_tasks_org ON public.outbound_tasks(organization_id, status);

ALTER TABLE public.outbound_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbound_tasks_select_org" ON public.outbound_tasks
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "outbound_tasks_update_org" ON public.outbound_tasks
  FOR UPDATE USING (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_outbound_tasks_updated_at
  BEFORE UPDATE ON public.outbound_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- owner_queue
CREATE TABLE IF NOT EXISTS public.owner_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  role_filter TEXT,
  last_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_queue_org_user_role
  ON public.owner_queue(organization_id, user_id, COALESCE(role_filter, ''));

CREATE INDEX IF NOT EXISTS idx_owner_queue_org_active
  ON public.owner_queue(organization_id, is_active, last_assigned_at NULLS FIRST);

ALTER TABLE public.owner_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_queue_select_org" ON public.owner_queue
  FOR SELECT USING (organization_id = public.get_user_organization_id());

CREATE POLICY "owner_queue_admin_manage" ON public.owner_queue
  FOR ALL USING (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER trg_owner_queue_updated_at
  BEFORE UPDATE ON public.owner_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: seed default rules
CREATE OR REPLACE FUNCTION public.seed_default_decision_rules(_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.decision_rules (
    organization_id, name, description, priority,
    min_score, min_confidence,
    action_create_opportunity, action_create_task, action_assign_owner, action_enroll_sequence,
    owner_strategy, priority_label, task_template
  )
  SELECT _org_id, 'Hot Lead — Auto Execution',
    'Score ≥ 220 e confiança ≥ 70: cria oportunidade, atribui owner, gera task e inicia sequência.',
    10, 220, 70, true, true, true, true, 'round_robin', 'hot',
    jsonb_build_object(
      'task_type','email',
      'subject','HOT LEAD: {{company_name}}',
      'description','Lead de alta prioridade detectado. Score: {{score}}. Atuar nas próximas 2h.'
    )
  WHERE NOT EXISTS (SELECT 1 FROM public.decision_rules WHERE organization_id=_org_id AND name='Hot Lead — Auto Execution');

  INSERT INTO public.decision_rules (
    organization_id, name, description, priority,
    min_score, max_score, min_confidence,
    action_create_opportunity, action_create_task, action_assign_owner, action_enroll_sequence,
    owner_strategy, priority_label, task_template
  )
  SELECT _org_id, 'Warm Lead — SDR Queue',
    'Score 180–219: cria oportunidade, atribui SDR e gera task de qualificação.',
    20, 180, 219, 50, true, true, true, false, 'round_robin', 'warm',
    jsonb_build_object(
      'task_type','call',
      'subject','Qualificar: {{company_name}}',
      'description','Lead morno. Validar fit antes de avançar.'
    )
  WHERE NOT EXISTS (SELECT 1 FROM public.decision_rules WHERE organization_id=_org_id AND name='Warm Lead — SDR Queue');

  INSERT INTO public.decision_rules (
    organization_id, name, description, priority,
    max_score,
    action_create_opportunity, action_create_task, action_assign_owner, action_enroll_sequence,
    priority_label
  )
  SELECT _org_id, 'Low Priority Lead',
    'Score < 180: registra somente, sem ações automáticas.',
    30, 179, false, false, false, false, 'cold'
  WHERE NOT EXISTS (SELECT 1 FROM public.decision_rules WHERE organization_id=_org_id AND name='Low Priority Lead');
END;
$$;

-- Backfill existing orgs
DO $$
DECLARE org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_decision_rules(org.id);
  END LOOP;
END;
$$;

-- Function: claim next owner (round-robin, race-safe)
CREATE OR REPLACE FUNCTION public.claim_next_owner_round_robin(
  _organization_id UUID,
  _role_filter TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _queue_id UUID;
BEGIN
  SELECT id, user_id INTO _queue_id, _user_id
  FROM public.owner_queue
  WHERE organization_id = _organization_id
    AND is_active = true
    AND (_role_filter IS NULL OR role_filter = _role_filter OR role_filter IS NULL)
  ORDER BY last_assigned_at NULLS FIRST, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.owner_queue SET last_assigned_at = now() WHERE id = _queue_id;
  RETURN _user_id;
END;
$$;
