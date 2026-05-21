// PRICE AUDIT MAY 2026 — Service para auditoria financeira retroativa de propostas.
// Toda mutação passa por RPCs SECURITY DEFINER. UI nunca recalcula valores.
import { supabase } from '@/integrations/supabase/client';

export type AuditStatus = 'ok' | 'divergent' | 'needs_review' | 'fixed' | 'ignored';
export type CanonicalSource =
  | 'approval_snapshot'
  | 'approved_amount'
  | 'approved_payment_schedule'
  | 'pricing_breakdown_snapshot'
  | 'payment_intent'
  | 'erp_payload'
  | 'manual_review'
  | 'ledger'
  | 'indeterminate';

export type AuditScopeStatus =
  | 'in_scope'
  | 'out_of_scope_duplicate'
  | 'out_of_scope_superseded'
  | 'out_of_scope_draft'
  | 'out_of_scope_old_version'
  | 'out_of_scope_non_winning'
  | 'needs_scope_review';

export interface AuditRun {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  status: 'running' | 'completed' | 'failed';
  dry_run: boolean;
  total_proposals: number;
  ok_count: number;
  divergent_count: number;
  needs_review_count: number;
  total_approved_amount: number;
  total_detected_delta: number;
  in_scope_count: number;
  out_of_scope_count: number;
  needs_scope_review_count: number;
  in_scope_delta: number;
  out_of_scope_delta: number;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditItem {
  id: string;
  organization_id: string;
  audit_run_id: string;
  proposal_id: string;
  proposal_number: string | null;
  opportunity_id: string | null;
  account_name: string | null;
  seller_name: string | null;
  proposal_status: string | null;
  opportunity_status: string | null;
  approved_at: string | null;
  slack_amount: number | null;
  deal_amount: number | null;
  proposal_total_amount: number | null;
  ledger_effective_amount: number | null;
  ledger_erp_amount: number | null;
  approved_amount: number | null;
  approval_snapshot_amount: number | null;
  payment_schedule_total: number | null;
  payment_intent_expected_amount: number | null;
  erp_sent_amount: number | null;
  reconstructed_ledger_amount: number | null;
  canonical_amount: number | null;
  canonical_source: CanonicalSource | null;
  max_delta: number;
  divergence_types: string[];
  recommended_action: string | null;
  audit_status: AuditStatus;
  notes: string | null;
  raw_values: Record<string, unknown>;
  applied_at: string | null;
  applied_by: string | null;
  applied_mode: string | null;
  is_winning_proposal: boolean;
  is_superseded: boolean;
  is_duplicate_candidate: boolean;
  is_operational_clone: boolean;
  proposal_rank_for_opportunity: number | null;
  proposal_selection_reason: string | null;
  source_proposal_id: string | null;
  duplicated_from_proposal_id: string | null;
  superseded_by_proposal_id: string | null;
  audit_scope_status: AuditScopeStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditItemFilters {
  runId?: string;
  status?: AuditStatus;
  sellerName?: string;
  hasDivergence?: boolean;
  canonicalSource?: CanonicalSource;
  search?: string;
  /** Default: in_scope + needs_scope_review. Set to 'all' to include out_of_scope. */
  scopeMode?: 'default' | 'all' | 'only_out_of_scope';
}

export async function runAudit(opts: {
  periodStart: string;
  periodEnd: string;
  dryRun?: boolean;
}): Promise<{
  audit_run_id: string;
  total_proposals: number;
  ok_count: number;
  divergent_count: number;
  needs_review_count: number;
  total_detected_delta: number;
  dry_run: boolean;
}> {
  const { data, error } = await supabase.rpc('run_proposal_financial_audit' as any, {
    p_period_start: opts.periodStart,
    p_period_end: opts.periodEnd,
    p_dry_run: opts.dryRun ?? true,
  });
  if (error) throw error;
  return data as any;
}

export async function listAuditRuns(): Promise<AuditRun[]> {
  const { data, error } = await supabase
    .from('proposal_financial_audit_runs' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as AuditRun[];
}

export async function listAuditItems(filters: AuditItemFilters): Promise<AuditItem[]> {
  let q = supabase
    .from('proposal_financial_audit_items' as any)
    .select('*')
    .order('max_delta', { ascending: false })
    .limit(1000);
  if (filters.runId) q = q.eq('audit_run_id', filters.runId);
  if (filters.status) q = q.eq('audit_status', filters.status);
  if (filters.canonicalSource) q = q.eq('canonical_source', filters.canonicalSource);
  if (filters.hasDivergence) q = q.gt('max_delta', 0.01);
  if (filters.sellerName) q = q.ilike('seller_name', `%${filters.sellerName}%`);
  if (filters.search) q = q.or(`proposal_number.ilike.%${filters.search}%,account_name.ilike.%${filters.search}%`);
  const mode = filters.scopeMode ?? 'default';
  if (mode === 'default') {
    q = q.in('audit_scope_status', ['in_scope', 'needs_scope_review']);
  } else if (mode === 'only_out_of_scope') {
    q = q.in('audit_scope_status', [
      'out_of_scope_duplicate', 'out_of_scope_superseded',
      'out_of_scope_draft', 'out_of_scope_old_version', 'out_of_scope_non_winning',
    ]);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AuditItem[];
}

export async function getAuditItem(id: string): Promise<AuditItem | null> {
  const { data, error } = await supabase
    .from('proposal_financial_audit_items' as any)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as AuditItem) ?? null;
}

export async function applyAuditItem(
  id: string,
  mode: 'safe' | 'mirror_legacy_total' | 'force_with_snapshot' = 'safe',
): Promise<any> {
  const { data, error } = await supabase.rpc('apply_proposal_financial_audit_item' as any, {
    p_audit_item_id: id,
    p_apply_mode: mode,
  });
  if (error) throw error;
  return data;
}

export async function ignoreAuditItem(id: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('ignore_proposal_financial_audit_item' as any, {
    p_audit_item_id: id,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function markAuditItemReview(id: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('mark_proposal_financial_audit_item_review' as any, {
    p_audit_item_id: id,
    p_note: note ?? null,
  });
  if (error) throw error;
}
