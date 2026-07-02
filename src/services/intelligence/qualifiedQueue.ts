import { supabase } from '@/integrations/supabase/client';

export type QualificationStatus =
  | 'captured'
  | 'existing_customer'
  | 'existing_account'
  | 'duplicate'
  | 'enriched'
  | 'decision_maker_found'
  | 'contact_revealed'
  | 'approach_ready'
  | 'ready_for_sdr'
  | 'human_review'
  | 'imported'
  | 'discarded';

export interface QualifiedQueueItem {
  id: string;
  organization_id: string;
  event_id: string | null;
  prospect_id: string;
  company_name: string;
  domain: string | null;
  source: string | null;
  source_type: string | null;
  relationship_status: string | null;
  score: number;
  grade: string | null;
  confidence: number | null;
  icp_match: boolean;
  enrichment_status: string | null;
  decision_maker_status: string | null;
  contact_status: string | null;
  qualification_status: QualificationStatus;
  sdr_ready: boolean;
  approach_brief: Record<string, unknown> | null;
  owner_id: string | null;
  review_reason: string | null;
  discard_reason: string | null;
  imported_at: string | null;
  imported_opportunity_id: string | null;
  imported_account_id: string | null;
  imported_contact_id: string | null;
  created_at: string;
  updated_at: string;
  coverage_score?: number | null;
  coverage_class?: 'complete' | 'good' | 'partial' | 'weak' | 'new' | null;
  missing_items?: string[] | null;
  next_best_action?: string | null;
  company_intelligence_score?: number | null;
  company_grade?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | null;
  company_next_best_action?: string | null;
  company_recommended_strategy?: string | null;
  apollo_recommended?: boolean | null;
  sdr_recommended?: boolean | null;
  company_human_review_required?: boolean | null;
}

export type CompanyGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export async function computeCompanyIntelligence(prospectId: string, forceRecompute = false) {
  const { data, error } = await supabase.functions.invoke('kairos-compute-company-intelligence', {
    body: { prospect_id: prospectId, force_recompute: forceRecompute },
  });
  if (error) throw error;
  return data;
}

export interface QualifiedQueueFilters {
  eventId?: string | null;
  icpOnly?: boolean;
  status?: QualificationStatus | 'all';
  relationship?: string | 'all';
  scoreMin?: number;
  withDecisionMaker?: boolean | null;
  sdrReadyOnly?: boolean;
  humanReviewOnly?: boolean;
  search?: string;
  limit?: number;
  companyGrades?: CompanyGrade[];
  apolloRecommended?: boolean;
  sdrRecommended?: boolean;
}

export async function listQualifiedQueue(
  organizationId: string,
  filters: QualifiedQueueFilters = {},
): Promise<QualifiedQueueItem[]> {
  let q = supabase
    .from('kairos_qualified_queue' as any)
    .select('*')
    .eq('organization_id', organizationId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.eventId) q = q.eq('event_id', filters.eventId);
  if (filters.icpOnly) q = q.eq('icp_match', true);
  if (filters.status && filters.status !== 'all') q = q.eq('qualification_status', filters.status);
  if (filters.relationship && filters.relationship !== 'all')
    q = q.eq('relationship_status', filters.relationship);
  if (typeof filters.scoreMin === 'number') q = q.gte('score', filters.scoreMin);
  if (filters.withDecisionMaker === true) q = q.in('decision_maker_status', ['found', 'revealed']);
  if (filters.withDecisionMaker === false) q = q.not('decision_maker_status', 'in', '("found","revealed")');
  if (filters.sdrReadyOnly) q = q.eq('sdr_ready', true);
  if (filters.humanReviewOnly) q = q.eq('qualification_status', 'human_review');
  if (filters.search?.trim()) q = q.ilike('company_name', `%${filters.search.trim()}%`);
  if (filters.companyGrades?.length) q = q.in('company_grade', filters.companyGrades);
  if (filters.apolloRecommended === true) q = q.eq('apollo_recommended', true);
  if (filters.sdrRecommended === true) q = q.eq('sdr_recommended', true);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as QualifiedQueueItem[];
}

export interface QualifiedQueueKpis {
  captured: number;
  qualified: number;
  ready_for_sdr: number;
  review: number;
  imported: number;
  discarded: number;
  conversion_rate: number;
}

export async function getQualifiedQueueKpis(organizationId: string): Promise<QualifiedQueueKpis> {
  const { data, error } = await (supabase as any)
    .from('kairos_qualified_queue')
    .select('qualification_status,sdr_ready,score')
    .eq('organization_id', organizationId)
    .limit(5000);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ qualification_status: QualificationStatus; sdr_ready: boolean; score: number }>;
  const total = rows.length;
  const captured = total;
  const qualified = rows.filter((r) => r.score >= 60).length;
  const ready_for_sdr = rows.filter((r) => r.qualification_status === 'ready_for_sdr' || r.sdr_ready).length;
  const review = rows.filter((r) => r.qualification_status === 'human_review').length;
  const imported = rows.filter((r) => r.qualification_status === 'imported').length;
  const discarded = rows.filter((r) => r.qualification_status === 'discarded').length;
  const conversion_rate = total === 0 ? 0 : Math.round((imported / total) * 100);
  return { captured, qualified, ready_for_sdr, review, imported, discarded, conversion_rate };
}

export async function updateQueueItem(
  id: string,
  patch: Partial<QualifiedQueueItem>,
): Promise<void> {
  const { error } = await supabase.from('kairos_qualified_queue' as any).update(patch as any).eq('id', id);
  if (error) throw error;
}

export async function discardQueueItem(id: string, reason: string): Promise<void> {
  await updateQueueItem(id, { qualification_status: 'discarded', discard_reason: reason });
}

export async function sendToHumanReview(id: string, reason: string): Promise<void> {
  await updateQueueItem(id, { qualification_status: 'human_review', review_reason: reason });
}
