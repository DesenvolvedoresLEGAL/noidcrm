/**
 * Sprint 2.8 — Mapper puro de Handoff V2.
 */
import type { ReportHandoffV2 } from '@/types/reportingV2';

export interface HandoffRowView {
  sdrUserId: string;
  closerUserId: string;
  sdrName: string;
  closerName: string;
  totalHandoffs: number;
  wonCount: number;
  lostCount: number;
  wonRevenue: number;
  winRatePct: number | null;
  avgQualificationHours: number | null;
}

export interface HandoffTotals {
  totalHandoffs: number;
  totalWon: number;
  totalLost: number;
  totalRevenue: number;
  weightedWinRatePct: number | null;
  avgQualificationHours: number | null;
}

export interface HandoffView {
  rows: HandoffRowView[];
  totals: HandoffTotals;
}

function mapRow(r: ReportHandoffV2): HandoffRowView {
  return {
    sdrUserId: r.sdr_user_id,
    closerUserId: r.closer_user_id,
    sdrName: r.sdr_name ?? 'SDR',
    closerName: r.closer_name ?? 'Closer',
    totalHandoffs: r.total_handoffs ?? 0,
    wonCount: r.won_count ?? 0,
    lostCount: r.lost_count ?? 0,
    wonRevenue: r.won_revenue ?? 0,
    winRatePct: r.win_rate_pct,
    avgQualificationHours: r.avg_qualification_hours,
  };
}

export function mapHandoffV2(raw: ReportHandoffV2[] | null | undefined): HandoffView {
  const rows = (raw ?? []).map(mapRow);
  const totalWon = rows.reduce((s, r) => s + r.wonCount, 0);
  const totalLost = rows.reduce((s, r) => s + r.lostCount, 0);
  const processed = totalWon + totalLost;
  const totals: HandoffTotals = {
    totalHandoffs: rows.reduce((s, r) => s + r.totalHandoffs, 0),
    totalWon,
    totalLost,
    totalRevenue: rows.reduce((s, r) => s + r.wonRevenue, 0),
    weightedWinRatePct: processed > 0 ? (totalWon / processed) * 100 : null,
    avgQualificationHours: (() => {
      const valid = rows.filter((r) => r.avgQualificationHours !== null);
      if (valid.length === 0) return null;
      return valid.reduce((s, r) => s + (r.avgQualificationHours as number), 0) / valid.length;
    })(),
  };
  return { rows, totals };
}
