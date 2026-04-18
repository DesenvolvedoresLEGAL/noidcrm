/**
 * Sprint 2.7 — Mapper puro de Summary V2.
 * Apenas rename/format. Zero regra de negócio.
 */
import type { ReportSummaryV2 } from '@/types/reportingV2';

export interface SummaryV2View {
  activePipelineCount: number;
  activePipelineValue: number;
  wonCount: number;
  wonRevenue: number;
  lostCount: number;
  lostValue: number;
  processedCount: number;
  winRatePct: number | null;
  avgWonTicket: number;
}

export function mapSummaryV2(raw: ReportSummaryV2 | null | undefined): SummaryV2View | null {
  if (!raw) return null;
  return {
    activePipelineCount: raw.active_pipeline_count ?? 0,
    activePipelineValue: raw.active_pipeline_value ?? 0,
    wonCount: raw.won_count ?? 0,
    wonRevenue: raw.won_revenue ?? 0,
    lostCount: raw.lost_count ?? 0,
    lostValue: raw.lost_value ?? 0,
    processedCount: raw.processed_count ?? 0,
    winRatePct: raw.win_rate_pct,
    avgWonTicket: raw.avg_won_ticket ?? 0,
  };
}
