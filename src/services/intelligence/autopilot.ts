import { supabase } from '@/integrations/supabase/client';

export type AutopilotStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type AutopilotStage = 'matching' | 'queue' | 'enrichment' | 'apollo' | 'decision_maker' | 'approach' | 'ready' | 'completed';
export type AutopilotItemStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

export interface AutopilotConfig {
  icp_profile_id?: string | null;
  min_score?: number;
  min_quality?: string | null;
  max_apollo_credits?: number;
  max_contacts_per_company?: number;
  allow_enrichment?: boolean;
  allow_apollo?: boolean;
  generate_brief?: boolean;
}

export interface AutopilotRun {
  id: string;
  organization_id: string;
  event_id: string | null;
  lead_search_id: string | null;
  run_name: string;
  run_type: string;
  status: AutopilotStatus;
  total_prospects: number;
  processed: number;
  skipped: number;
  failed: number;
  credits_estimated: number;
  credits_used: number;
  config: AutopilotConfig;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutopilotItem {
  id: string;
  run_id: string;
  organization_id: string;
  prospect_id: string;
  current_stage: AutopilotStage;
  status: AutopilotItemStatus;
  message: string | null;
  priority_rank: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutopilotLog {
  id: string;
  run_id: string;
  prospect_id: string | null;
  action: string;
  result: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export async function listAutopilotRuns(organizationId: string, limit = 50): Promise<AutopilotRun[]> {
  const { data, error } = await (supabase as any)
    .from('kairos_batch_runs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AutopilotRun[];
}

export async function getAutopilotRun(runId: string): Promise<AutopilotRun | null> {
  const { data, error } = await (supabase as any).from('kairos_batch_runs').select('*').eq('id', runId).maybeSingle();
  if (error) throw error;
  return data as AutopilotRun | null;
}

export async function listAutopilotItems(runId: string, limit = 500): Promise<AutopilotItem[]> {
  const { data, error } = await (supabase as any)
    .from('kairos_batch_run_items')
    .select('*')
    .eq('run_id', runId)
    .order('priority_rank', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AutopilotItem[];
}

export async function listAutopilotLogs(runId: string, limit = 200): Promise<AutopilotLog[]> {
  const { data, error } = await (supabase as any)
    .from('kairos_batch_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AutopilotLog[];
}

export interface AutopilotKpis {
  total_runs: number;
  running: number;
  total_processed: number;
  total_sdr_ready: number;
  total_credits_used: number;
  avg_yield: number;
}

export async function getAutopilotKpis(organizationId: string): Promise<AutopilotKpis> {
  const { data: runs } = await (supabase as any)
    .from('kairos_batch_runs')
    .select('status,processed,credits_used,total_prospects')
    .eq('organization_id', organizationId);
  const list = (runs ?? []) as Array<{ status: AutopilotStatus; processed: number; credits_used: number; total_prospects: number }>;
  const totalProcessed = list.reduce((s, r) => s + (r.processed ?? 0), 0);
  const totalCredits = list.reduce((s, r) => s + (r.credits_used ?? 0), 0);
  const totalRequested = list.reduce((s, r) => s + (r.total_prospects ?? 0), 0);

  const { count: sdrReady } = await (supabase as any)
    .from('kairos_qualified_queue')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('sdr_ready', true);

  return {
    total_runs: list.length,
    running: list.filter((r) => r.status === 'running').length,
    total_processed: totalProcessed,
    total_sdr_ready: sdrReady ?? 0,
    total_credits_used: totalCredits,
    avg_yield: totalRequested === 0 ? 0 : Math.round((totalProcessed / totalRequested) * 100),
  };
}
