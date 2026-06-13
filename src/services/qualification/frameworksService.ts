// Sprint 2 — Régua de Qualificação: camada de serviço (CRUD + bundle + apply template)
import { supabase } from '@/integrations/supabase/client';
import type {
  QualificationFramework,
  QualificationFrameworkBundle,
  QualificationCriterion,
  QualificationCriterionField,
  QualificationScoreRange,
  QualificationBlockingRule,
  QualificationDisqualificationReason,
  QualificationAutomation,
} from '@/types/qualification';

const FW_TABLE = 'qualification_frameworks';

type AnySb = any;

export async function listFrameworks(): Promise<QualificationFramework[]> {
  const { data, error } = await (supabase as AnySb)
    .from(FW_TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as QualificationFramework[];
}

export async function getActiveFramework(): Promise<QualificationFramework | null> {
  const { data, error } = await (supabase as AnySb)
    .from(FW_TABLE)
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as QualificationFramework | null) ?? null;
}

export async function getFrameworkBundle(
  frameworkId: string
): Promise<QualificationFrameworkBundle | null> {
  const sb = supabase as AnySb;
  const [
    fwRes,
    criteriaRes,
    fieldsRes,
    rangesRes,
    blockingRes,
    reasonsRes,
    autoRes,
  ] = await Promise.all([
    sb.from(FW_TABLE).select('*').eq('id', frameworkId).maybeSingle(),
    sb.from('qualification_criteria').select('*').eq('framework_id', frameworkId).order('order_index'),
    sb.from('qualification_criterion_fields').select('*').eq('framework_id', frameworkId).order('order_index'),
    sb.from('qualification_score_ranges').select('*').eq('framework_id', frameworkId).order('order_index'),
    sb.from('qualification_blocking_rules').select('*').eq('framework_id', frameworkId).order('order_index'),
    sb.from('qualification_disqualification_reasons').select('*').eq('framework_id', frameworkId).order('order_index'),
    sb.from('qualification_automations').select('*').eq('framework_id', frameworkId).order('order_index'),
  ]);
  if (fwRes.error) throw fwRes.error;
  if (!fwRes.data) return null;
  return {
    framework: fwRes.data as QualificationFramework,
    criteria: (criteriaRes.data ?? []) as QualificationCriterion[],
    fields: (fieldsRes.data ?? []) as QualificationCriterionField[],
    ranges: (rangesRes.data ?? []) as QualificationScoreRange[],
    blockingRules: (blockingRes.data ?? []) as QualificationBlockingRule[],
    reasons: (reasonsRes.data ?? []) as QualificationDisqualificationReason[],
    automations: (autoRes.data ?? []) as QualificationAutomation[],
  };
}

export async function setFrameworkActive(id: string, isActive: boolean) {
  const { error } = await (supabase as AnySb)
    .from(FW_TABLE)
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

export async function updateFramework(
  id: string,
  patch: Partial<
    Pick<
      QualificationFramework,
      | 'name'
      | 'description'
      | 'minimum_score_to_advance'
      | 'applies_to_pipeline_ids'
      | 'applies_to_stage_ids'
      | 'target_pipeline_id'
      | 'is_active'
    >
  >
) {
  const { error } = await (supabase as AnySb)
    .from(FW_TABLE)
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFramework(id: string) {
  const { error } = await (supabase as AnySb).from(FW_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function applyLegalTemplate(): Promise<string> {
  const { data, error } = await (supabase as AnySb).rpc(
    'apply_qualification_template_legal'
  );
  if (error) throw error;
  return data as string;
}

export async function updateCriterion(
  id: string,
  patch: Partial<QualificationCriterion>
) {
  const { error } = await (supabase as AnySb)
    .from('qualification_criteria')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function updateAutomation(
  id: string,
  patch: Partial<QualificationAutomation>
) {
  const { error } = await (supabase as AnySb)
    .from('qualification_automations')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function updateReason(
  id: string,
  patch: Partial<QualificationDisqualificationReason>
) {
  const { error } = await (supabase as AnySb)
    .from('qualification_disqualification_reasons')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function updateBlockingRule(
  id: string,
  patch: Partial<QualificationBlockingRule>
) {
  const { error } = await (supabase as AnySb)
    .from('qualification_blocking_rules')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}
