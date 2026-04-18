/**
 * Sprint 2.8 — Mapper puro de SDR Performance V2.
 */
import type { ReportSDRV2 } from '@/types/reportingV2';

export interface SdrRowView {
  sdrUserId: string;
  sdrName: string;
  sqlsGenerated: number;
  wonCount: number;
  lostCount: number;
  revenueAttributed: number;
  winRatePct: number | null;
  avgQualificationHours: number | null;
}

export interface SdrTotals {
  totalSqls: number;
  totalWon: number;
  totalLost: number;
  totalRevenue: number;
  weightedWinRatePct: number | null;
  avgQualificationHours: number | null;
}

export interface SdrView {
  rows: SdrRowView[];
  totals: SdrTotals;
}

function mapRow(r: ReportSDRV2): SdrRowView {
  return {
    sdrUserId: r.sdr_user_id,
    sdrName: r.sdr_name ?? 'SDR',
    sqlsGenerated: r.sqls_generated ?? 0,
    wonCount: r.won_count ?? 0,
    lostCount: r.lost_count ?? 0,
    revenueAttributed: r.revenue_attributed ?? 0,
    winRatePct: r.win_rate_pct,
    avgQualificationHours: r.avg_qualification_hours,
  };
}

export function mapSdrV2(raw: ReportSDRV2[] | null | undefined): SdrView {
  const rows = (raw ?? []).map(mapRow);
  const totalWon = rows.reduce((s, r) => s + r.wonCount, 0);
  const totalLost = rows.reduce((s, r) => s + r.lostCount, 0);
  const processed = totalWon + totalLost;
  const totals: SdrTotals = {
    totalSqls: rows.reduce((s, r) => s + r.sqlsGenerated, 0),
    totalWon,
    totalLost,
    totalRevenue: rows.reduce((s, r) => s + r.revenueAttributed, 0),
    weightedWinRatePct: processed > 0 ? (totalWon / processed) * 100 : null,
    avgQualificationHours: (() => {
      const valid = rows.filter((r) => r.avgQualificationHours !== null);
      if (valid.length === 0) return null;
      const sum = valid.reduce((s, r) => s + (r.avgQualificationHours as number), 0);
      return sum / valid.length;
    })(),
  };
  return { rows, totals };
}
