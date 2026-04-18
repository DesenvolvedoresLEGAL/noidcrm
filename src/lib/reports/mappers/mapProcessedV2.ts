/**
 * Sprint 2.8 — Mapper puro de Processadas V2.
 */
import type { ReportProcessedV2 } from '@/types/reportingV2';

export interface ProcessedView {
  processedCount: number;
  wonCount: number;
  wonRevenue: number;
  avgWonTicket: number;
  lostCount: number;
  lostValue: number;
  avgLostTicket: number;
  winRatePct: number | null;
}

export function mapProcessedV2(raw: ReportProcessedV2 | null | undefined): ProcessedView | null {
  if (!raw) return null;
  return {
    processedCount: raw.processed_count ?? 0,
    wonCount: raw.won_count ?? 0,
    wonRevenue: raw.won_revenue ?? 0,
    avgWonTicket: raw.avg_won_ticket ?? 0,
    lostCount: raw.lost_count ?? 0,
    lostValue: raw.lost_value ?? 0,
    avgLostTicket: raw.avg_lost_ticket ?? 0,
    winRatePct: raw.win_rate_pct,
  };
}
