import { supabase } from "@/integrations/supabase/client";

// === Cadence Policies ===

export async function listCadencePolicies(agentId: string) {
  const { data, error } = await supabase
    .from("ai_email_cadence_policies")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCadencePolicy(payload: {
  organization_id: string;
  agent_id: string;
  agent_version_id?: string;
  name: string;
  description?: string;
  cadence_type?: string;
  max_steps?: number;
  stop_on_reply?: boolean;
  stop_on_stage_change?: boolean;
  stop_on_manual_override?: boolean;
  applies_to_pipeline_id?: string;
  applies_to_stage_id?: string;
  created_by?: string;
}) {
  const { data, error } = await supabase
    .from("ai_email_cadence_policies")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCadencePolicy(id: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("ai_email_cadence_policies")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCadencePolicy(id: string) {
  const { error } = await supabase.from("ai_email_cadence_policies").delete().eq("id", id);
  if (error) throw error;
}

// === Cadence Steps ===

export async function listCadenceSteps(policyId: string) {
  const { data, error } = await supabase
    .from("ai_email_cadence_steps")
    .select("*")
    .eq("cadence_policy_id", policyId)
    .order("step_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertCadenceStep(payload: {
  id?: string;
  organization_id: string;
  cadence_policy_id: string;
  step_order: number;
  step_name: string;
  email_purpose: string;
  min_delay_hours?: number;
  objective_primary?: string;
  tone_guidance?: string;
  cta_guidance?: string;
  angle_guidance?: string;
  approval_override?: boolean;
}) {
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase
      .from("ai_email_cadence_steps")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("ai_email_cadence_steps")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCadenceStep(id: string) {
  const { error } = await supabase.from("ai_email_cadence_steps").delete().eq("id", id);
  if (error) throw error;
}

// === Cooldown Policies ===

export async function getCooldownPolicy(agentId: string) {
  const { data, error } = await supabase
    .from("ai_email_cooldown_policies")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function upsertCooldownPolicy(payload: Record<string, unknown>) {
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase
      .from("ai_email_cooldown_policies")
      .update({ ...rest, updated_at: new Date().toISOString() } as any)
      .eq("id", id as string)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("ai_email_cooldown_policies")
    .insert(payload as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// === Pipeline Rules ===

export async function listPipelineRules(agentId: string) {
  const { data, error } = await supabase
    .from("ai_email_pipeline_rules")
    .select("*")
    .eq("agent_id", agentId)
    .order("priority", { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertPipelineRule(payload: Record<string, unknown>) {
  if (payload.id) {
    const { id, ...rest } = payload;
    const { data, error } = await supabase
      .from("ai_email_pipeline_rules")
      .update({ ...rest, updated_at: new Date().toISOString() } as any)
      .eq("id", id as string)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("ai_email_pipeline_rules")
    .insert(payload as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePipelineRule(id: string) {
  const { error } = await supabase.from("ai_email_pipeline_rules").delete().eq("id", id);
  if (error) throw error;
}

// === Cadence Progress ===

export async function listCadenceProgress(agentId: string, filters?: { status?: string; opportunity_id?: string }) {
  let query = supabase
    .from("ai_email_cadence_progress")
    .select("*, ai_email_cadence_policies(name)")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.opportunity_id) query = query.eq("opportunity_id", filters.opportunity_id);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data;
}
