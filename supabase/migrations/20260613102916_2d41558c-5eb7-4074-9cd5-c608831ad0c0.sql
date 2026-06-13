
-- =========================================================
-- Sprint 1 — Régua de Qualificação: schema base
-- =========================================================

-- 1) qualification_frameworks
CREATE TABLE public.qualification_frameworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  applies_to_pipeline_ids UUID[] NOT NULL DEFAULT '{}',
  applies_to_stage_ids UUID[] NOT NULL DEFAULT '{}',
  target_pipeline_id UUID,
  minimum_score_to_advance INTEGER NOT NULL DEFAULT 75,
  template_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
CREATE INDEX idx_qual_fw_org ON public.qualification_frameworks(organization_id);
CREATE INDEX idx_qual_fw_active ON public.qualification_frameworks(organization_id, is_active) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_frameworks TO authenticated;
GRANT ALL ON public.qualification_frameworks TO service_role;
ALTER TABLE public.qualification_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_fw_org_select" ON public.qualification_frameworks
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());
CREATE POLICY "qual_fw_org_insert" ON public.qualification_frameworks
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "qual_fw_org_update" ON public.qualification_frameworks
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "qual_fw_org_delete" ON public.qualification_frameworks
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_qual_fw_updated_at
  BEFORE UPDATE ON public.qualification_frameworks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) qualification_criteria
CREATE TABLE public.qualification_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.qualification_frameworks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  weight INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  criterion_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_crit_fw ON public.qualification_criteria(framework_id, order_index);
CREATE INDEX idx_qual_crit_org ON public.qualification_criteria(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_criteria TO authenticated;
GRANT ALL ON public.qualification_criteria TO service_role;
ALTER TABLE public.qualification_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_crit_org_all" ON public.qualification_criteria
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_qual_crit_updated_at
  BEFORE UPDATE ON public.qualification_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) qualification_criterion_fields
CREATE TABLE public.qualification_criterion_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.qualification_frameworks(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.qualification_criteria(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  field_source TEXT NOT NULL CHECK (field_source IN ('native_opportunity','native_company','native_contact','custom_field','form_field')),
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  points INTEGER NOT NULL DEFAULT 0,
  is_required_for_score BOOLEAN NOT NULL DEFAULT false,
  is_required_for_advance BOOLEAN NOT NULL DEFAULT false,
  validation_type TEXT,
  invalid_values TEXT[] NOT NULL DEFAULT '{}',
  min_value NUMERIC,
  max_value NUMERIC,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_cf_crit ON public.qualification_criterion_fields(criterion_id, order_index);
CREATE INDEX idx_qual_cf_fw ON public.qualification_criterion_fields(framework_id);
CREATE INDEX idx_qual_cf_org ON public.qualification_criterion_fields(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_criterion_fields TO authenticated;
GRANT ALL ON public.qualification_criterion_fields TO service_role;
ALTER TABLE public.qualification_criterion_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_cf_org_all" ON public.qualification_criterion_fields
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_qual_cf_updated_at
  BEFORE UPDATE ON public.qualification_criterion_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) qualification_score_ranges
CREATE TABLE public.qualification_score_ranges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.qualification_frameworks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  label TEXT NOT NULL,
  range_key TEXT,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  color TEXT,
  description TEXT,
  is_sql BOOLEAN NOT NULL DEFAULT false,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (min_score >= 0 AND max_score <= 100 AND min_score <= max_score)
);
CREATE INDEX idx_qual_sr_fw ON public.qualification_score_ranges(framework_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_score_ranges TO authenticated;
GRANT ALL ON public.qualification_score_ranges TO service_role;
ALTER TABLE public.qualification_score_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_sr_org_all" ON public.qualification_score_ranges
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_qual_sr_updated_at
  BEFORE UPDATE ON public.qualification_score_ranges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) qualification_blocking_rules
CREATE TABLE public.qualification_blocking_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.qualification_frameworks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  action_key TEXT NOT NULL,
  action_label TEXT NOT NULL,
  target_pipeline_id UUID,
  target_stage_id UUID,
  minimum_score INTEGER,
  require_all_required_fields BOOLEAN NOT NULL DEFAULT true,
  require_valid_proposal_permission BOOLEAN NOT NULL DEFAULT false,
  block_message_title TEXT,
  block_message_body TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_br_fw ON public.qualification_blocking_rules(framework_id, action_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_blocking_rules TO authenticated;
GRANT ALL ON public.qualification_blocking_rules TO service_role;
ALTER TABLE public.qualification_blocking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_br_org_all" ON public.qualification_blocking_rules
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_qual_br_updated_at
  BEFORE UPDATE ON public.qualification_blocking_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) qualification_disqualification_reasons
CREATE TABLE public.qualification_disqualification_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.qualification_frameworks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  reason_label TEXT NOT NULL,
  reason_key TEXT NOT NULL,
  category TEXT,
  accountability TEXT,
  send_to_remarketing_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_id, reason_key)
);
CREATE INDEX idx_qual_dr_fw ON public.qualification_disqualification_reasons(framework_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_disqualification_reasons TO authenticated;
GRANT ALL ON public.qualification_disqualification_reasons TO service_role;
ALTER TABLE public.qualification_disqualification_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_dr_org_all" ON public.qualification_disqualification_reasons
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_qual_dr_updated_at
  BEFORE UPDATE ON public.qualification_disqualification_reasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) qualification_automations
CREATE TABLE public.qualification_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.qualification_frameworks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  trigger_key TEXT NOT NULL CHECK (trigger_key IN ('on_disqualify','on_reach_minimum_score','on_below_minimum_score','on_classification_change')),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_auto_fw ON public.qualification_automations(framework_id, trigger_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_automations TO authenticated;
GRANT ALL ON public.qualification_automations TO service_role;
ALTER TABLE public.qualification_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_auto_org_all" ON public.qualification_automations
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_qual_auto_updated_at
  BEFORE UPDATE ON public.qualification_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) qualification_framework_audit_log
CREATE TABLE public.qualification_framework_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.qualification_frameworks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_audit_fw ON public.qualification_framework_audit_log(framework_id, performed_at DESC);

GRANT SELECT, INSERT ON public.qualification_framework_audit_log TO authenticated;
GRANT ALL ON public.qualification_framework_audit_log TO service_role;
ALTER TABLE public.qualification_framework_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qual_audit_org_select" ON public.qualification_framework_audit_log
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());
CREATE POLICY "qual_audit_org_insert" ON public.qualification_framework_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());
