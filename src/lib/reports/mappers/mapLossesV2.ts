/**
 * Sprint 2.7 — Mapper puro de Losses V2 (agregado e detalhe).
 */
import type { ReportLossesV2 } from '@/types/reportingV2';

export interface LossesAggregateV2View {
  consolidatedLossReasonId: string | null;
  lossReasonSource: string | null;
  classificationStatus: string | null;
  coverageBucket: string | null;
  lostCount: number;
  lostValue: number;
  avgLostTicket: number;
}

export function mapLossesAggregate(
  rows: ReportLossesV2[] | null | undefined,
): LossesAggregateV2View[] {
  if (!rows) return [];
  return rows.map((r) => ({
    consolidatedLossReasonId: r.consolidated_loss_reason_id,
    lossReasonSource: r.loss_reason_source,
    classificationStatus: r.loss_classification_status,
    coverageBucket: r.loss_coverage_bucket,
    lostCount: r.lost_count ?? 0,
    lostValue: r.lost_value ?? 0,
    avgLostTicket: r.avg_lost_ticket ?? 0,
  }));
}

export interface LossesTotals {
  totalLost: number;
  totalValue: number;
  avgTicket: number;
  fullCoveragePct: number;
  anyCoveragePct: number;
  legacyUnclassifiedPct: number;
}

export function computeLossesTotals(rows: LossesAggregateV2View[]): LossesTotals {
  const totalLost = rows.reduce((s, r) => s + r.lostCount, 0);
  const totalValue = rows.reduce((s, r) => s + r.lostValue, 0);
  const avgTicket = totalLost > 0 ? totalValue / totalLost : 0;

  if (totalLost === 0) {
    return { totalLost, totalValue, avgTicket, fullCoveragePct: 0, anyCoveragePct: 0, legacyUnclassifiedPct: 0 };
  }

  const fullCount = rows
    .filter((r) => r.classificationStatus === 'full')
    .reduce((s, r) => s + r.lostCount, 0);
  const anyCount = rows
    .filter((r) => r.classificationStatus && r.classificationStatus !== 'none')
    .reduce((s, r) => s + r.lostCount, 0);
  const legacyCount = rows
    .filter((r) => r.coverageBucket === 'legacy_unclassified' || r.classificationStatus === 'none')
    .reduce((s, r) => s + r.lostCount, 0);

  return {
    totalLost,
    totalValue,
    avgTicket,
    fullCoveragePct: (fullCount / totalLost) * 100,
    anyCoveragePct: (anyCount / totalLost) * 100,
    legacyUnclassifiedPct: (legacyCount / totalLost) * 100,
  };
}

/** Detalhe (linha-por-linha) — vem de v_report_losses_detail_v2. */
export interface LossDetailV2View {
  opportunityId: string;
  opportunityTitle: string | null;
  ownerName: string | null;
  sdrName: string | null;
  sellerReason: string | null;
  clientReason: string | null;
  winLossReason: string | null;
  consolidatedReason: string | null;
  reasonSource: string | null;
  lostValue: number;
  amountSource: string | null;
  competitor: string | null;
  discount: number | null;
  cycleDays: number | null;
  observation: string | null;
  lostAt: string | null;
}

export function mapLossDetail(rows: any[] | null | undefined): LossDetailV2View[] {
  if (!rows) return [];
  return rows.map((r) => ({
    opportunityId: r.opportunity_id,
    opportunityTitle: r.opportunity_title ?? r.title ?? null,
    ownerName: r.owner_name ?? null,
    sdrName: r.sdr_name ?? r.qualified_by_name ?? null,
    sellerReason: r.seller_loss_reason_name ?? null,
    clientReason: r.client_loss_reason_name ?? null,
    winLossReason: r.win_loss_reason_name ?? null,
    consolidatedReason: r.consolidated_loss_reason_name ?? null,
    reasonSource: r.loss_reason_source ?? null,
    lostValue: r.lost_value ?? 0,
    amountSource: r.amount_source ?? null,
    competitor: r.competitor ?? null,
    discount: r.discount_value ?? r.discount ?? null,
    cycleDays: r.sales_cycle_days ?? r.cycle_days ?? null,
    observation: r.observation ?? r.loss_observation ?? null,
    lostAt: r.lost_at ?? null,
  }));
}
