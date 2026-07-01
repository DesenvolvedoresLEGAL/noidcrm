import { supabase } from '@/integrations/supabase/client';

export type SkillStatus = 'draft' | 'active' | 'deprecated' | 'archived';
export type SkillCategory =
  | 'prospecting' | 'qualification' | 'objection_handling' | 'negotiation'
  | 'follow_up' | 'reactivation' | 'proposal' | 'technical_explanation'
  | 'pricing' | 'handoff' | 'next_best_action';
export type SkillType =
  | 'message_generation' | 'classification' | 'recommendation'
  | 'objection_response' | 'qualification_question' | 'summary' | 'next_best_action';

export interface NoidSkill {
  id: string;
  organization_id: string | null;
  slug: string;
  name: string;
  category: SkillCategory;
  skill_type: SkillType;
  status: SkillStatus;
  version: number;
  description: string | null;
  system_prompt: string;
  task_prompt: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  guardrails: Record<string, any>;
  examples: any[];
  created_at: string;
  updated_at: string;
}

export interface NoidSkillRun {
  id: string;
  organization_id: string | null;
  skill_id: string;
  source_module: string | null;
  input_payload: any;
  output_payload: any;
  model_used: string | null;
  status: string;
  confidence_score: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SkillMetric {
  skill_id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  skill_type: SkillType;
  status: SkillStatus;
  version: number;
  run_count: number;
  success_count: number;
  positive_feedback: number;
  negative_feedback: number;
  edited_count: number;
  latency_p50_ms: number | null;
  last_run_at: string | null;
}

export async function listSkills(): Promise<NoidSkill[]> {
  const { data, error } = await (supabase as any)
    .from('noid_skills')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as NoidSkill[];
}

export async function getSkill(id: string): Promise<NoidSkill> {
  const { data, error } = await (supabase as any)
    .from('noid_skills')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as NoidSkill;
}

export async function listSkillMetrics(): Promise<SkillMetric[]> {
  const { data, error } = await (supabase as any)
    .from('v_noid_skill_metrics')
    .select('*');
  if (error) throw error;
  return (data ?? []) as SkillMetric[];
}

export async function listSkillRuns(skillId: string, limit = 25): Promise<NoidSkillRun[]> {
  const { data, error } = await (supabase as any)
    .from('noid_skill_runs')
    .select('*')
    .eq('skill_id', skillId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NoidSkillRun[];
}

export async function runSkill(params: {
  skill_id?: string;
  slug?: string;
  context: Record<string, any>;
  source_module?: string;
  dry_run?: boolean;
  links?: Record<string, any>;
}) {
  const { data, error } = await supabase.functions.invoke('noid-run-skill', { body: params });
  if (error) throw error;
  return data as {
    run_id: string;
    skill_id: string;
    skill_slug: string;
    status: string;
    output: any;
    model_used: string;
    latency_ms: number;
  };
}

export async function routeSkill(params: {
  source_module: string;
  goal: string;
  context: Record<string, any>;
  preferred_category?: string;
  links?: Record<string, any>;
}) {
  const { data, error } = await supabase.functions.invoke('noid-skill-router', { body: params });
  if (error) throw error;
  return data;
}

export async function submitSkillFeedback(params: {
  skill_run_id: string;
  organization_id: string;
  feedback_type: 'positive' | 'negative' | 'edited_by_user' | 'used_in_outreach' | 'ignored' | 'converted' | 'failed';
  rating?: number;
  feedback_notes?: string;
}) {
  const { data, error } = await (supabase as any)
    .from('noid_skill_feedback')
    .insert(params)
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export const CATEGORY_LABEL: Record<SkillCategory, string> = {
  prospecting: 'Prospecção',
  qualification: 'Qualificação',
  objection_handling: 'Objeções',
  negotiation: 'Negociação',
  follow_up: 'Follow-up',
  reactivation: 'Reativação',
  proposal: 'Proposta',
  technical_explanation: 'Técnica',
  pricing: 'Preço',
  handoff: 'Handoff',
  next_best_action: 'Next Best Action',
};

export const TYPE_LABEL: Record<SkillType, string> = {
  message_generation: 'Mensagem',
  classification: 'Classificação',
  recommendation: 'Recomendação',
  objection_response: 'Objeção',
  qualification_question: 'Pergunta',
  summary: 'Resumo',
  next_best_action: 'NBA',
};

export const STATUS_LABEL: Record<SkillStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  deprecated: 'Depreciada',
  archived: 'Arquivada',
};
