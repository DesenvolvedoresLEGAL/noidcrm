/**
 * P0 Revenue SSoT — serviço único de leitura sobre `commercial_won_revenue_view`.
 *
 * Toda receita realizada (Dashboard, Forecast, Relatórios, Win/Loss, Comissão)
 * deve consumir SOMENTE este serviço. Nunca somar `valor_previsto`,
 * `proposals.total_amount`, `v_opportunity_amounts_v2`, RPCs antigas etc.
 *
 * Eligibilidade de comissão vem de `commission_eligibility_view`.
 */
import { supabase } from '@/integrations/supabase/client';

export interface RevenueSsotParams {
  organizationId: string;
  start: string; // ISO date-time
  end: string;   // ISO date-time
  pipelineIds?: string[] | null;
  sellerIds?: string[] | null;
  revenueType?: 'all' | 'one_time' | 'mrr' | 'mixed';
}

export interface ClosedRevenueRow {
  organization_id: string;
  opportunity_id: string;
  accepted_proposal_id: string | null;
  proposal_number: string | null;
  account_id?: string | null;
  account_name: string | null;
  nome_fantasia: string | null;
  seller_id: string | null;
  seller_name: string | null;
  pipeline_id: string | null;
  pipeline_name?: string | null;
  stage_id?: string | null;
  stage_name?: string | null;
  won_at: string | null;
  commercial_amount: number;
  one_shot_amount: number;
  mrr_amount: number;
  commercial_amount_source: string;
  revenue_confidence: 'trusted' | 'warning' | 'manual_review';
  review_required: boolean;
  warnings: string[];
  commercial_status?: string | null;
  fulfillment_status?: string | null;
  financial_settlement_status?: string | null;
}

export interface ClosedRevenueSummary {
  total: number;
  avulsa: number;
  mrr: number;
  count: number;
  avgTicket: number;
  eligible: number;
  pendingSettlement: number;
  pendingReview: number;
}

export interface RevenueGroup {
  key: string;
  label: string;
  total: number;
  count: number;
  avgTicket: number;
}

async function fetchRows(p: RevenueSsotParams): Promise<ClosedRevenueRow[]> {
  let q = (supabase as any)
    .from('commercial_won_revenue_view')
    .select('*')
    .eq('organization_id', p.organizationId)
    .gte('won_at', p.start)
    .lte('won_at', p.end);

  if (p.pipelineIds?.length) q = q.in('pipeline_id', p.pipelineIds);
  if (p.sellerIds?.length) q = q.in('seller_id', p.sellerIds);

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as ClosedRevenueRow[];

  if (p.revenueType && p.revenueType !== 'all') {
    rows = rows.filter((r) => {
      const mrr = Number(r.mrr_amount) || 0;
      const one = Number(r.one_shot_amount) || 0;
      if (p.revenueType === 'mrr') return mrr > 0 && one === 0;
      if (p.revenueType === 'one_time') return one > 0 && mrr === 0;
      if (p.revenueType === 'mixed') return mrr > 0 && one > 0;
      return true;
    });
  }
  return rows;
}

async function fetchCommissionMap(orgId: string): Promise<Map<string, string>> {
  const { data } = await (supabase as any)
    .from('commission_eligibility_view')
    .select('opportunity_id, commission_status')
    .eq('organization_id', orgId);
  return new Map<string, string>((data ?? []).map((e: any) => [e.opportunity_id, e.commission_status]));
}

export async function getClosedRevenueRows(p: RevenueSsotParams): Promise<ClosedRevenueRow[]> {
  return fetchRows(p);
}

export async function getClosedRevenueSummary(p: RevenueSsotParams): Promise<ClosedRevenueSummary> {
  const [rows, commissionMap] = await Promise.all([fetchRows(p), fetchCommissionMap(p.organizationId)]);
  const summary = rows.reduce<ClosedRevenueSummary>(
    (acc, r) => {
      const amt = Number(r.commercial_amount) || 0;
      acc.total += amt;
      acc.avulsa += Number(r.one_shot_amount) || 0;
      acc.mrr += Number(r.mrr_amount) || 0;
      acc.count += 1;
      const cs = commissionMap.get(r.opportunity_id);
      if (cs === 'blocked_review_required') acc.pendingReview += amt;
      else if (cs === 'blocked_settlement_pending') acc.pendingSettlement += amt;
      else acc.eligible += amt;
      return acc;
    },
    { total: 0, avulsa: 0, mrr: 0, count: 0, avgTicket: 0, eligible: 0, pendingSettlement: 0, pendingReview: 0 },
  );
  summary.avgTicket = summary.count > 0 ? summary.total / summary.count : 0;
  return summary;
}

function groupBy(rows: ClosedRevenueRow[], keyFn: (r: ClosedRevenueRow) => { key: string; label: string }): RevenueGroup[] {
  const map = new Map<string, RevenueGroup>();
  for (const r of rows) {
    const { key, label } = keyFn(r);
    const cur = map.get(key) ?? { key, label, total: 0, count: 0, avgTicket: 0 };
    cur.total += Number(r.commercial_amount) || 0;
    cur.count += 1;
    map.set(key, cur);
  }
  for (const g of map.values()) g.avgTicket = g.count > 0 ? g.total / g.count : 0;
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export async function getRevenueBySeller(p: RevenueSsotParams): Promise<RevenueGroup[]> {
  const rows = await fetchRows(p);
  return groupBy(rows, (r) => ({ key: r.seller_id ?? '—', label: r.seller_name ?? 'Sem vendedor' }));
}

/**
 * Atribuição histórica imutável (Sprint OTE).
 * Lê de `commercial_won_revenue_historical_view` — mesma base que
 * `commercial_won_revenue_view`, porém com `seller_id` resolvido no momento
 * do ganho via `opportunity_owner_history`. Use em Resultados/OTE/Comissão
 * para que transferência operacional NÃO mexa em resultado histórico.
 */
export async function getHistoricalRevenueBySeller(p: RevenueSsotParams): Promise<RevenueGroup[]> {
  let q = (supabase as any)
    .from('commercial_won_revenue_historical_view')
    .select('seller_id, seller_name, commercial_amount')
    .eq('organization_id', p.organizationId)
    .gte('won_at', p.start)
    .lte('won_at', p.end);
  if (p.pipelineIds?.length) q = q.in('pipeline_id', p.pipelineIds);
  if (p.sellerIds?.length) q = q.in('seller_id', p.sellerIds);
  const { data, error } = await q;
  if (error) throw error;
  const map = new Map<string, RevenueGroup>();
  for (const r of (data ?? []) as Array<{ seller_id: string | null; seller_name: string | null; commercial_amount: number | null }>) {
    const key = r.seller_id ?? '—';
    const cur = map.get(key) ?? { key, label: r.seller_name ?? 'Sem vendedor', total: 0, count: 0, avgTicket: 0 };
    cur.total += Number(r.commercial_amount) || 0;
    cur.count += 1;
    map.set(key, cur);
  }
  for (const g of map.values()) g.avgTicket = g.count > 0 ? g.total / g.count : 0;
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}


export async function getRevenueByPipeline(p: RevenueSsotParams): Promise<RevenueGroup[]> {
  const rows = await fetchRows(p);
  return groupBy(rows, (r) => ({ key: r.pipeline_id ?? '—', label: r.pipeline_name ?? 'Sem pipeline' }));
}

export async function getRevenueByStage(p: RevenueSsotParams): Promise<RevenueGroup[]> {
  const rows = await fetchRows(p);
  return groupBy(rows, (r) => ({ key: r.stage_id ?? '—', label: r.stage_name ?? 'Ganhamos' }));
}

export async function getRevenueByType(p: RevenueSsotParams): Promise<{ mrr: number; one_time: number; mixed: number }> {
  const rows = await fetchRows(p);
  return rows.reduce(
    (acc, r) => {
      const mrr = Number(r.mrr_amount) || 0;
      const one = Number(r.one_shot_amount) || 0;
      if (mrr > 0 && one > 0) acc.mixed += Number(r.commercial_amount) || 0;
      else if (mrr > 0) acc.mrr += Number(r.commercial_amount) || 0;
      else acc.one_time += Number(r.commercial_amount) || 0;
      return acc;
    },
    { mrr: 0, one_time: 0, mixed: 0 },
  );
}

export const revenueSsotService = {
  getClosedRevenueRows,
  getClosedRevenueSummary,
  getRevenueBySeller,
  getRevenueByPipeline,
  getRevenueByStage,
  getRevenueByType,
};
