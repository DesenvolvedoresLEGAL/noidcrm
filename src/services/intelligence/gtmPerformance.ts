import { supabase } from "@/integrations/supabase/client";

export interface GtmPerformanceRow {
  organization_id: string;
  event_id: string | null;
  event_name: string | null;
  icp_cluster_id: string | null;
  icp_cluster_name: string | null;
  batch_run_id: string | null;
  owner_id: string | null;
  sdr_id: string | null;
  primary_contact_department: string | null;
  source_type: string | null;
  captured_count: number;
  queued_count: number;
  enriched_count: number;
  apollo_executed_count: number;
  decision_maker_found_count: number;
  contact_revealed_count: number;
  approach_ready_count: number;
  sdr_ready_count: number;
  promoted_to_crm_count: number;
  opportunities_created_count: number;
  proposals_created_count: number;
  proposals_sent_count: number;
  proposals_viewed_count: number;
  won_count: number;
  lost_count: number;
  valid_revenue_amount: number;
  revenue_amount: number;
  apollo_credits_used: number;
  apollo_dm_found_count: number;
}

export interface GtmRecommendation {
  id: string;
  organization_id: string;
  recommendation_type: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  title: string;
  description: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  impact_estimate: number;
  confidence_score: number;
  status: "open" | "acknowledged" | "dismissed" | "resolved";
  metric_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GtmFilters {
  eventId?: string;
  icpId?: string;
  batchRunId?: string;
  sdrId?: string;
  department?: string;
  sourceType?: string;
}

function n(v: unknown): number { return Number(v ?? 0); }

export async function listGtmPerformance(filters: GtmFilters = {}): Promise<GtmPerformanceRow[]> {
  let q: any = supabase.from("kairos_gtm_performance_summary" as any).select("*").limit(5000);
  if (filters.eventId) q = q.eq("event_id", filters.eventId);
  if (filters.icpId) q = q.eq("icp_cluster_id", filters.icpId);
  if (filters.batchRunId) q = q.eq("batch_run_id", filters.batchRunId);
  if (filters.sdrId) q = q.eq("sdr_id", filters.sdrId);
  if (filters.department) q = q.eq("primary_contact_department", filters.department);
  if (filters.sourceType) q = q.eq("source_type", filters.sourceType);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as GtmPerformanceRow[]).map((r) => ({
    ...r,
    captured_count: n(r.captured_count),
    queued_count: n(r.queued_count),
    enriched_count: n(r.enriched_count),
    apollo_executed_count: n(r.apollo_executed_count),
    decision_maker_found_count: n(r.decision_maker_found_count),
    contact_revealed_count: n(r.contact_revealed_count),
    approach_ready_count: n(r.approach_ready_count),
    sdr_ready_count: n(r.sdr_ready_count),
    promoted_to_crm_count: n(r.promoted_to_crm_count),
    opportunities_created_count: n(r.opportunities_created_count),
    proposals_created_count: n(r.proposals_created_count),
    proposals_sent_count: n(r.proposals_sent_count),
    proposals_viewed_count: n(r.proposals_viewed_count),
    won_count: n(r.won_count),
    lost_count: n(r.lost_count),
    valid_revenue_amount: n(r.valid_revenue_amount),
    revenue_amount: n(r.revenue_amount),
    apollo_credits_used: n(r.apollo_credits_used),
    apollo_dm_found_count: n(r.apollo_dm_found_count),
  }));
}

export async function listGtmRecommendations(): Promise<GtmRecommendation[]> {
  const { data, error } = await supabase
    .from("kairos_gtm_recommendations" as any)
    .select("*")
    .eq("status", "open")
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as GtmRecommendation[];
}

export async function updateRecommendationStatus(id: string, status: GtmRecommendation["status"]) {
  const { error } = await supabase
    .from("kairos_gtm_recommendations" as any)
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function refreshGtmPerformance() {
  const [a, b] = await Promise.all([
    supabase.functions.invoke("kairos-compute-gtm-performance", { body: {} }),
    supabase.functions.invoke("kairos-generate-gtm-recommendations", { body: {} }),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  return { performance: a.data, recommendations: b.data };
}

// ===== Aggregations =====
export interface GtmKpis {
  valid_revenue: number;
  captured: number;
  sdr_ready: number;
  promoted: number;
  proposals_sent: number;
  won: number;
  capture_to_sdr_ready: number;
  proposal_to_won: number;
  apollo_credits: number;
  revenue_per_credit: number;
}

export function computeKpis(rows: GtmPerformanceRow[]): GtmKpis {
  let captured = 0, sdrReady = 0, promoted = 0, sent = 0, won = 0, revenue = 0, credits = 0, proposalsCreated = 0;
  for (const r of rows) {
    captured += r.captured_count;
    sdrReady += r.sdr_ready_count;
    promoted += r.promoted_to_crm_count;
    sent += r.proposals_sent_count;
    won += r.won_count;
    revenue += r.valid_revenue_amount;
    credits += r.apollo_credits_used;
    proposalsCreated += r.proposals_created_count;
  }
  return {
    valid_revenue: revenue,
    captured,
    sdr_ready: sdrReady,
    promoted,
    proposals_sent: sent,
    won,
    capture_to_sdr_ready: captured ? sdrReady / captured : 0,
    proposal_to_won: proposalsCreated ? won / proposalsCreated : 0,
    apollo_credits: credits,
    revenue_per_credit: credits ? revenue / credits : 0,
  };
}

export interface FunnelStage {
  label: string;
  value: number;
  prev?: number;
}
export function buildFunnel(rows: GtmPerformanceRow[]): FunnelStage[] {
  const k = computeKpis(rows);
  let enriched = 0, dm = 0, opps = 0, propsCreated = 0;
  for (const r of rows) {
    enriched += r.enriched_count;
    dm += r.decision_maker_found_count;
    opps += r.opportunities_created_count;
    propsCreated += r.proposals_created_count;
  }
  const stages = [
    { label: "Capturados", value: k.captured },
    { label: "Enriquecidos", value: enriched },
    { label: "Decisor encontrado", value: dm },
    { label: "SDR Ready", value: k.sdr_ready },
    { label: "Promovidos CRM", value: k.promoted },
    { label: "Oportunidades", value: opps },
    { label: "Propostas", value: propsCreated },
    { label: "Enviadas", value: k.proposals_sent },
    { label: "Vendas", value: k.won },
  ];
  return stages.map((s, i) => ({ ...s, prev: i === 0 ? undefined : stages[i - 1].value }));
}

export interface Bottleneck {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  lossAbsolute: number;
  lossPct: number;
}
export function detectBottlenecks(rows: GtmPerformanceRow[]): Bottleneck[] {
  const f = buildFunnel(rows);
  const out: Bottleneck[] = [];
  for (let i = 1; i < f.length; i++) {
    const prev = f[i - 1].value;
    const cur = f[i].value;
    if (prev <= 0) continue;
    const loss = prev - cur;
    const lossPct = loss / prev;
    if (loss <= 0) continue;
    let severity: Bottleneck["severity"] = "low";
    if (lossPct >= 0.7) severity = "high";
    else if (lossPct >= 0.4) severity = "medium";
    if (severity === "low" && lossPct < 0.3) continue;
    out.push({
      id: `${f[i - 1].label}->${f[i].label}`,
      title: `${f[i - 1].label} → ${f[i].label}`,
      description: `Perda de ${loss} (${(lossPct * 100).toFixed(1)}%) nesta etapa.`,
      severity,
      lossAbsolute: loss,
      lossPct,
    });
  }
  return out;
}

type RankKey = "event_name" | "icp_cluster_name" | "batch_run_id" | "primary_contact_department" | "sdr_id";
export interface RankRow {
  key: string;
  label: string;
  captured: number;
  sdr_ready: number;
  promoted: number;
  proposals: number;
  proposals_sent: number;
  won: number;
  revenue: number;
  credits: number;
  conversion: number;
  apollo_roi: number;
}
export function rankBy(rows: GtmPerformanceRow[], by: RankKey, fallback = "—"): RankRow[] {
  const map = new Map<string, RankRow>();
  for (const r of rows) {
    const key = (r[by] as string | null) ?? "__null__";
    const label = ((r[by] as string | null) ?? fallback) as string;
    const cur = map.get(key) ?? {
      key, label,
      captured: 0, sdr_ready: 0, promoted: 0, proposals: 0, proposals_sent: 0,
      won: 0, revenue: 0, credits: 0, conversion: 0, apollo_roi: 0,
    };
    cur.captured += r.captured_count;
    cur.sdr_ready += r.sdr_ready_count;
    cur.promoted += r.promoted_to_crm_count;
    cur.proposals += r.proposals_created_count;
    cur.proposals_sent += r.proposals_sent_count;
    cur.won += r.won_count;
    cur.revenue += r.valid_revenue_amount;
    cur.credits += r.apollo_credits_used;
    map.set(key, cur);
  }
  const result = Array.from(map.values()).map((r) => ({
    ...r,
    conversion: r.captured ? r.won / r.captured : 0,
    apollo_roi: r.credits ? r.revenue / r.credits : 0,
  }));
  result.sort((a, b) => b.revenue - a.revenue || b.won - a.won);
  return result;
}

export function toCsv(rows: RankRow[], labelHeader: string): string {
  const headers = [labelHeader, "Capturados", "SDR Ready", "Promovidos", "Propostas", "Enviadas", "Vendas", "Receita", "Créditos Apollo", "Conversão", "ROI Apollo"];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) {
    lines.push([
      r.label, r.captured, r.sdr_ready, r.promoted, r.proposals, r.proposals_sent,
      r.won, r.revenue.toFixed(2), r.credits, (r.conversion * 100).toFixed(2), r.apollo_roi.toFixed(2),
    ].map(esc).join(","));
  }
  return lines.join("\n");
}
