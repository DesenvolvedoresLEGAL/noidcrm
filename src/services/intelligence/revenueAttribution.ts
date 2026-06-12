import { supabase } from "@/integrations/supabase/client";

export type AttributionStatus =
  | "sourced"
  | "queued"
  | "promoted_to_crm"
  | "opportunity_open"
  | "proposal_created"
  | "proposal_sent"
  | "proposal_viewed"
  | "won"
  | "lost"
  | "cancelled";

export interface RevenueAttributionRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  event_name: string | null;
  batch_run_id: string | null;
  prospect_id: string | null;
  queue_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  proposal_id: string | null;
  contract_id: string | null;
  source_type: string | null;
  source_name: string | null;
  icp_cluster_id: string | null;
  icp_cluster_name: string | null;
  apollo_provider_used: string | null;
  primary_contact_department: string | null;
  primary_contact_role: string | null;
  primary_contact_score: number | null;
  owner_id: string | null;
  sdr_id: string | null;
  opportunity_created_at: string | null;
  proposal_created_at: string | null;
  proposal_sent_at: string | null;
  proposal_viewed_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  revenue_amount: number | null;
  valid_revenue_amount: number | null;
  status: AttributionStatus;
  created_at: string;
  updated_at: string;
}

export interface AttributionFilters {
  start?: string;
  end?: string;
  eventId?: string;
  icpId?: string;
  batchRunId?: string;
  sdrId?: string;
  ownerId?: string;
  status?: AttributionStatus;
  department?: string;
}

function applyFilters(query: any, f: AttributionFilters) {
  if (f.start) query = query.gte("opportunity_created_at", f.start);
  if (f.end) query = query.lte("opportunity_created_at", f.end);
  if (f.eventId) query = query.eq("event_id", f.eventId);
  if (f.icpId) query = query.eq("icp_cluster_id", f.icpId);
  if (f.batchRunId) query = query.eq("batch_run_id", f.batchRunId);
  if (f.sdrId) query = query.eq("sdr_id", f.sdrId);
  if (f.ownerId) query = query.eq("owner_id", f.ownerId);
  if (f.status) query = query.eq("status", f.status);
  if (f.department) query = query.eq("primary_contact_department", f.department);
  return query;
}

export async function listAttributions(filters: AttributionFilters = {}) {
  let q: any = supabase.from("kairos_revenue_attribution" as any).select("*").order("updated_at", { ascending: false }).limit(1000);
  q = applyFilters(q, filters);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RevenueAttributionRow[];
}

export interface AttributionKpis {
  attributions: number;
  opportunities_open: number;
  proposals_created: number;
  proposals_sent: number;
  proposals_viewed: number;
  won: number;
  lost: number;
  cancelled: number;
  revenue_total: number;
  valid_revenue_total: number;
  avg_ticket: number;
  conversion_rate: number;
}

export function computeKpis(rows: RevenueAttributionRow[]): AttributionKpis {
  const won = rows.filter((r) => r.status === "won");
  const validRevenue = won.reduce((s, r) => s + Number(r.valid_revenue_amount ?? 0), 0);
  const revenue = won.reduce((s, r) => s + Number(r.revenue_amount ?? 0), 0);
  return {
    attributions: rows.length,
    opportunities_open: rows.filter((r) => r.status === "opportunity_open").length,
    proposals_created: rows.filter((r) => !!r.proposal_id).length,
    proposals_sent: rows.filter((r) => !!r.proposal_sent_at).length,
    proposals_viewed: rows.filter((r) => !!r.proposal_viewed_at).length,
    won: won.length,
    lost: rows.filter((r) => r.status === "lost").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    revenue_total: revenue,
    valid_revenue_total: validRevenue,
    avg_ticket: won.length ? validRevenue / won.length : 0,
    conversion_rate: rows.length ? won.length / rows.length : 0,
  };
}

type RankKey = "event_name" | "icp_cluster_name" | "primary_contact_department" | "sdr_id" | "owner_id" | "batch_run_id";

export interface RankRow {
  key: string;
  label: string;
  attributions: number;
  proposals: number;
  proposals_sent: number;
  won: number;
  revenue: number;
  valid_revenue: number;
  avg_ticket: number;
  conversion: number;
}

export function rank(rows: RevenueAttributionRow[], by: RankKey, fallback = "—"): RankRow[] {
  const map = new Map<string, RankRow>();
  for (const r of rows) {
    const k = (r[by] as string | null) ?? "__null__";
    const label = ((r[by] as string | null) ?? fallback) as string;
    const cur = map.get(k) ?? {
      key: k,
      label,
      attributions: 0,
      proposals: 0,
      proposals_sent: 0,
      won: 0,
      revenue: 0,
      valid_revenue: 0,
      avg_ticket: 0,
      conversion: 0,
    };
    cur.attributions += 1;
    if (r.proposal_id) cur.proposals += 1;
    if (r.proposal_sent_at) cur.proposals_sent += 1;
    if (r.status === "won") {
      cur.won += 1;
      cur.revenue += Number(r.revenue_amount ?? 0);
      cur.valid_revenue += Number(r.valid_revenue_amount ?? 0);
    }
    map.set(k, cur);
  }
  const result = Array.from(map.values()).map((r) => ({
    ...r,
    avg_ticket: r.won ? r.valid_revenue / r.won : 0,
    conversion: r.attributions ? r.won / r.attributions : 0,
  }));
  result.sort((a, b) => b.valid_revenue - a.valid_revenue || b.won - a.won);
  return result;
}

export async function syncAttribution(opportunityId?: string) {
  const { data, error } = await supabase.functions.invoke("kairos-sync-revenue-attribution", {
    body: opportunityId ? { opportunity_id: opportunityId } : { limit: 500 },
  });
  if (error) throw error;
  return data;
}

export function toCsv(rows: RevenueAttributionRow[]): string {
  const headers = [
    "event_name", "icp_cluster_name", "batch_run_id", "primary_contact_department",
    "owner_id", "sdr_id", "status",
    "opportunity_id", "proposal_id",
    "opportunity_created_at", "proposal_sent_at", "won_at",
    "revenue_amount", "valid_revenue_amount",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc((r as any)[h])).join(","));
  }
  return lines.join("\n");
}
