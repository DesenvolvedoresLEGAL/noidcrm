/**
 * Sprint 2.8 — Mapper puro de Origens V2.
 * Apenas formatação/rename + highlights agregados de exibição.
 */
import type { ReportOriginsV2 } from '@/types/reportingV2';

export interface OriginRowView {
  originName: string;
  totalCount: number;
  wonCount: number;
  lostCount: number;
  openCount: number;
  wonRevenue: number;
  openPipelineValue: number;
  winRatePct: number | null;
  avgWonTicket: number;
}

export interface OriginsHighlights {
  totalOrigins: number;
  topByVolume: OriginRowView | null;
  topByRevenue: OriginRowView | null;
  topByWinRate: OriginRowView | null;
}

export interface OriginsView {
  rows: OriginRowView[];
  highlights: OriginsHighlights;
}

function mapRow(r: ReportOriginsV2): OriginRowView {
  return {
    originName: r.origin_name ?? '—',
    totalCount: r.total_count ?? 0,
    wonCount: r.won_count ?? 0,
    lostCount: r.lost_count ?? 0,
    openCount: r.open_count ?? 0,
    wonRevenue: r.won_revenue ?? 0,
    openPipelineValue: r.open_pipeline_value ?? 0,
    winRatePct: r.win_rate_pct,
    avgWonTicket: r.avg_won_ticket ?? 0,
  };
}

export function mapOriginsV2(raw: ReportOriginsV2[] | null | undefined): OriginsView {
  const rows = (raw ?? []).map(mapRow);
  const totalOrigins = rows.length;
  const topByVolume = rows.reduce<OriginRowView | null>(
    (acc, r) => (!acc || r.totalCount > acc.totalCount ? r : acc),
    null,
  );
  const topByRevenue = rows.reduce<OriginRowView | null>(
    (acc, r) => (!acc || r.wonRevenue > acc.wonRevenue ? r : acc),
    null,
  );
  const topByWinRate = rows.reduce<OriginRowView | null>((acc, r) => {
    if (r.winRatePct === null) return acc;
    if (!acc || (acc.winRatePct ?? -1) < (r.winRatePct ?? -1)) return r;
    return acc;
  }, null);
  return { rows, highlights: { totalOrigins, topByVolume, topByRevenue, topByWinRate } };
}
