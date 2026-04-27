import { supabase } from "@/integrations/supabase/client";

export interface DecisionRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  min_score: number | null;
  max_score: number | null;
  min_confidence: number | null;
  min_contact_score: number | null;
  action_create_opportunity: boolean;
  action_create_task: boolean;
  action_assign_owner: boolean;
  action_enroll_sequence: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  sequence_id: string | null;
  owner_strategy: "round_robin" | "fixed" | "territory" | null;
  fixed_owner_user_id: string | null;
  owner_role_filter: string | null;
  priority_label: "hot" | "warm" | "cold" | null;
  task_template: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type DecisionRuleInput = Partial<Omit<DecisionRule, "id" | "created_at" | "updated_at">>;

export interface DecisionLog {
  id: string;
  organization_id: string;
  prospect_id: string | null;
  enrichment_run_id: string | null;
  rule_id: string | null;
  score: number | null;
  confidence: number | null;
  quality_label: string | null;
  decision_taken: string;
  actions_executed: Record<string, any>;
  decision_payload: Record<string, any>;
  error_message: string | null;
  created_at: string;
}

export async function listDecisionRules(organizationId: string): Promise<DecisionRule[]> {
  const { data, error } = await supabase
    .from("decision_rules" as any)
    .select("*")
    .eq("organization_id", organizationId)
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DecisionRule[];
}

export async function createDecisionRule(input: DecisionRuleInput): Promise<DecisionRule> {
  const { data, error } = await supabase
    .from("decision_rules" as any)
    .insert(input as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DecisionRule;
}

export async function updateDecisionRule(id: string, input: DecisionRuleInput): Promise<DecisionRule> {
  const { data, error } = await supabase
    .from("decision_rules" as any)
    .update(input as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DecisionRule;
}

export async function deleteDecisionRule(id: string): Promise<void> {
  const { error } = await supabase.from("decision_rules" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function getLatestDecisionLog(prospectId: string): Promise<DecisionLog | null> {
  const { data, error } = await supabase
    .from("decision_logs" as any)
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DecisionLog) ?? null;
}

export async function listDecisionLogs(prospectId: string): Promise<DecisionLog[]> {
  const { data, error } = await supabase
    .from("decision_logs" as any)
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DecisionLog[];
}

export async function runDecisionEngine(params: {
  prospect_id: string;
  organization_id: string;
  enrichment_run_id?: string | null;
  dry_run?: boolean;
}): Promise<any> {
  const { data, error } = await supabase.functions.invoke("run-decision-engine", { body: params });
  if (error) throw error;
  return data;
}
