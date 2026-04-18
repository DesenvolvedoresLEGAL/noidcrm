/**
 * Sprint 2.7 — Mapper puro de Team V2.
 * NÃO faz média aritmética legacy. Win rate e ticket vêm da view.
 */
import type { ReportTeamV2 } from '@/types/reportingV2';

export interface TeamV2Row {
  ownerUserId: string;
  ownerName: string | null;
  wonCount: number;
  lostCount: number;
  activeCount: number;
  wonRevenue: number;
  activePipelineValue: number;
  winRatePct: number | null;
  avgWonTicket: number;
}

export function mapTeamV2(rows: ReportTeamV2[] | null | undefined): TeamV2Row[] {
  if (!rows) return [];
  return rows.map((r) => ({
    ownerUserId: r.owner_user_id,
    ownerName: r.owner_name,
    wonCount: r.won_count ?? 0,
    lostCount: r.lost_count ?? 0,
    activeCount: r.active_count ?? 0,
    wonRevenue: r.won_revenue ?? 0,
    activePipelineValue: r.active_pipeline_value ?? 0,
    winRatePct: r.win_rate_pct,
    avgWonTicket: r.avg_won_ticket ?? 0,
  }));
}

export interface TeamTotals {
  wonRevenue: number;
  wonCount: number;
  lostCount: number;
  activeCount: number;
  winRatePct: number | null; // calculado sobre soma, não média de win rates
  avgTicket: number;
}

export function computeTeamTotals(rows: TeamV2Row[]): TeamTotals {
  const wonRevenue = rows.reduce((s, r) => s + r.wonRevenue, 0);
  const wonCount = rows.reduce((s, r) => s + r.wonCount, 0);
  const lostCount = rows.reduce((s, r) => s + r.lostCount, 0);
  const activeCount = rows.reduce((s, r) => s + r.activeCount, 0);
  const processed = wonCount + lostCount;
  const winRatePct = processed > 0 ? (wonCount / processed) * 100 : null;
  const avgTicket = wonCount > 0 ? wonRevenue / wonCount : 0;
  return { wonRevenue, wonCount, lostCount, activeCount, winRatePct, avgTicket };
}
