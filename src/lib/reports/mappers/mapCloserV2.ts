/**
 * Sprint 2.7 — Mapper puro de Closer V2.
 */
import type { ReportCloserV2 } from '@/types/reportingV2';

export interface CloserV2Row {
  closerUserId: string;
  closerName: string | null;
  wonCount: number;
  lostCount: number;
  activeCount: number;
  wonRevenue: number;
  activePipelineValue: number;
  winRatePct: number | null;
  avgWonTicket: number;
  avgSalesCycleDays: number | null;
}

export function mapCloserV2(rows: ReportCloserV2[] | null | undefined): CloserV2Row[] {
  if (!rows) return [];
  return rows.map((r) => ({
    closerUserId: r.closer_user_id,
    closerName: r.closer_name,
    wonCount: r.won_count ?? 0,
    lostCount: r.lost_count ?? 0,
    activeCount: r.active_count ?? 0,
    wonRevenue: r.won_revenue ?? 0,
    activePipelineValue: r.active_pipeline_value ?? 0,
    winRatePct: r.win_rate_pct,
    avgWonTicket: r.avg_won_ticket ?? 0,
    avgSalesCycleDays: r.avg_sales_cycle_days,
  }));
}

export interface CloserTotals {
  wonRevenue: number;
  wonCount: number;
  lostCount: number;
  activeCount: number;
  winRatePct: number | null;
  avgTicket: number;
  avgCycleDays: number | null;
}

export function computeCloserTotals(rows: CloserV2Row[]): CloserTotals {
  const wonRevenue = rows.reduce((s, r) => s + r.wonRevenue, 0);
  const wonCount = rows.reduce((s, r) => s + r.wonCount, 0);
  const lostCount = rows.reduce((s, r) => s + r.lostCount, 0);
  const activeCount = rows.reduce((s, r) => s + r.activeCount, 0);
  const processed = wonCount + lostCount;
  const winRatePct = processed > 0 ? (wonCount / processed) * 100 : null;
  const avgTicket = wonCount > 0 ? wonRevenue / wonCount : 0;
  const cycleRows = rows.filter((r) => r.avgSalesCycleDays !== null && r.wonCount > 0);
  const avgCycleDays =
    cycleRows.length > 0
      ? cycleRows.reduce((s, r) => s + (r.avgSalesCycleDays ?? 0) * r.wonCount, 0) /
        cycleRows.reduce((s, r) => s + r.wonCount, 0)
      : null;
  return { wonRevenue, wonCount, lostCount, activeCount, winRatePct, avgTicket, avgCycleDays };
}
