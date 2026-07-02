import { supabase } from '@/integrations/supabase/client';

// KAI.18.5 — Apollo Query Logs (transparência total)
export type ApolloQueryMode = 'smart' | 'raw' | 'replay' | 'system';
export type ApolloCacheStatus = 'hit' | 'miss' | 'expired' | 'bypass' | 'invalidated';

export interface ApolloQueryLog {
  id: string;
  organization_id: string;
  prospect_id: string | null;
  triggered_by: string | null;
  endpoint: string;
  mode: ApolloQueryMode;
  replay_of: string | null;
  request_payload: Record<string, unknown>;
  request_headers_safe: Record<string, unknown>;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  apollo_request_id: string | null;
  people_returned: number;
  people_recommended: number;
  people_hidden: number;
  hidden_reasons: Record<string, number>;
  credits_used: number;
  cache_status: ApolloCacheStatus;
  fallback_used: boolean;
  latency_ms: number | null;
  retries: number;
  status: 'ok' | 'error' | 'timeout' | 'rate_limited';
  error_message: string | null;
  created_at: string;
  // KAI.18.6 — Apollo Wiretap
  parser_count: number | null;
  filter_count: number | null;
  eliminated_contacts: Array<{
    apollo_id: string | null;
    name: string | null;
    title: string | null;
    company: string | null;
    email: string | null;
    reasons: string[];
  }>;
  raw_response_full: unknown | null;
  raw_response_compressed: string | null;
  raw_response_size_bytes: number | null;
  raw_response_compressed_bool: boolean;
}

export async function listApolloQueryLogs(
  filters: { prospect_id?: string; organization_id?: string; limit?: number } = {},
): Promise<ApolloQueryLog[]> {
  let q = (supabase as any)
    .from('apollo_query_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 50);
  if (filters.prospect_id) q = q.eq('prospect_id', filters.prospect_id);
  if (filters.organization_id) q = q.eq('organization_id', filters.organization_id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ApolloQueryLog[];
}

export async function replayApolloQuery(prospect_id: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('run-apollo-enrichment', {
    body: { prospect_id, trigger_source: 'user', mode: 'replay', bypass_cache: true },
  });
  if (error) throw error;
  return data;
}

export async function runApolloRaw(prospect_id: string, custom_titles?: string[]): Promise<any> {
  const { data, error } = await supabase.functions.invoke('run-apollo-enrichment', {
    body: { prospect_id, trigger_source: 'user', mode: 'raw', bypass_cache: true, custom_titles },
  });
  if (error) throw error;
  return data;
}



export interface ApolloRules {
  id: string;
  organization_id: string;
  enabled: boolean;
  minimum_priority_score: number;
  allowed_quality_labels: string[];
  required_domain: boolean;
  allowed_relationship_status: string[];
  allowed_icps: string[] | null;
  max_contacts_per_company: number;
  max_apollo_credits_per_day: number;
  max_apollo_credits_per_batch: number;
  auto_select_primary_contact: boolean;
  auto_reveal_contact: boolean;
  // KAI.15.1 — Reveal Governance
  auto_reveal_email: boolean;
  auto_reveal_phone: boolean;
  auto_reveal_both: boolean;
  email_reveal_min_score: number;
  phone_reveal_min_score: number;
  max_email_reveals_per_company: number;
  max_phone_reveals_per_company: number;
  fallback_to_email_if_no_phone: boolean;
  created_at: string;
  updated_at: string;
}

export type RevealDataType = 'profile_only' | 'email' | 'phone' | 'both';

export interface RevealResult {
  status: 'revealed' | 'pending' | 'not_found' | 'rejected_company_phone' | 'failed' | 'skipped';
  success?: boolean;
  contact_id?: string;
  requested_data_type?: RevealDataType;
  phone_reveal_status?: string | null;
  phone_revealed?: boolean;
  phone_source_type?: 'person_mobile' | 'person_direct' | 'company_main' | 'unknown' | null;
  credits_estimated?: number;
  credits_used?: number;
  email?: string | null;
  phone?: string | null;
  phone_pending?: boolean;
  company_phone_rejected?: boolean;
  preferred_channel?: string;
  audit_id?: string | null;
  reason?: string;
}

export async function revealContact(params: {
  contact_id: string;
  prospect_id?: string;
  requested_data_type: RevealDataType;
  source?: 'manual' | 'autopilot' | 'sdr_agent' | 'apollo_invisible';
}): Promise<RevealResult> {
  const { data, error } = await supabase.functions.invoke('kairos-apollo-reveal-contact', { body: params });
  if (error) throw error;
  return data as RevealResult;
}

export interface ApolloAuditRow {
  id: string;
  organization_id: string;
  batch_run_id: string | null;
  prospect_id: string;
  company_name: string | null;
  apollo_status: 'skipped' | 'partial' | 'enriched' | 'failed';
  skip_reason: string | null;
  credits_used: number;
  contacts_found: number;
  contacts_revealed: number;
  primary_contact_id: string | null;
  decision_maker_found: boolean;
  icp_id: string | null;
  icp_category: string | null;
  priority_score: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ApolloEstimate {
  eligible_count: number;
  ineligible_count: number;
  ineligible_reasons: Record<string, number>;
  estimated_contacts: number;
  estimated_credits: number;
  daily_limit: number;
  daily_used: number;
  batch_limit: number;
  will_exceed_daily: boolean;
  will_exceed_batch: boolean;
}

export interface ApolloKpis {
  evaluated: number;
  executed: number;
  skipped: number;
  decision_makers: number;
  contacts_revealed: number;
  credits_used: number;
  cost_per_decision_maker: number;
  utilization_rate: number;
}

export async function getApolloRules(organizationId: string): Promise<ApolloRules | null> {
  const { data, error } = await (supabase as any)
    .from('apollo_auto_enrichment_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return data as ApolloRules | null;
}

export async function upsertApolloRules(
  organizationId: string,
  patch: Partial<ApolloRules>,
): Promise<ApolloRules> {
  const { data, error } = await (supabase as any)
    .from('apollo_auto_enrichment_rules')
    .upsert({ organization_id: organizationId, ...patch }, { onConflict: 'organization_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as ApolloRules;
}

export async function estimateApollo(params: {
  organization_id: string;
  prospect_ids?: string[];
  batch_run_id?: string;
}): Promise<ApolloEstimate> {
  const { data, error } = await supabase.functions.invoke('kairos-apollo-estimate', { body: params });
  if (error) throw error;
  return data as ApolloEstimate;
}

export async function listApolloAudit(
  organizationId: string,
  filters: { batchRunId?: string; status?: string; limit?: number } = {},
): Promise<ApolloAuditRow[]> {
  let q = (supabase as any)
    .from('apollo_enrichment_audit')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200);
  if (filters.batchRunId) q = q.eq('batch_run_id', filters.batchRunId);
  if (filters.status) q = q.eq('apollo_status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ApolloAuditRow[];
}

export async function getApolloKpis(
  organizationId: string,
  filters: { since?: string } = {},
): Promise<ApolloKpis> {
  let q = (supabase as any)
    .from('apollo_enrichment_audit')
    .select('apollo_status,credits_used,contacts_revealed,decision_maker_found')
    .eq('organization_id', organizationId);
  if (filters.since) q = q.gte('created_at', filters.since);
  const { data, error } = await q.limit(5000);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    apollo_status: string;
    credits_used: number;
    contacts_revealed: number;
    decision_maker_found: boolean;
  }>;
  const evaluated = rows.length;
  const executed = rows.filter((r) => ['enriched', 'partial'].includes(r.apollo_status)).length;
  const skipped = rows.filter((r) => r.apollo_status === 'skipped').length;
  const decision_makers = rows.filter((r) => r.decision_maker_found).length;
  const contacts_revealed = rows.reduce((s, r) => s + (r.contacts_revealed ?? 0), 0);
  const credits_used = rows.reduce((s, r) => s + (r.credits_used ?? 0), 0);
  const cost_per_decision_maker = decision_makers === 0 ? 0 : credits_used / decision_makers;
  const utilization_rate = evaluated === 0 ? 0 : Math.round((executed / evaluated) * 100);
  return {
    evaluated,
    executed,
    skipped,
    decision_makers,
    contacts_revealed,
    credits_used,
    cost_per_decision_maker,
    utilization_rate,
  };
}
