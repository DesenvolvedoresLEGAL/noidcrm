/**
 * Sprint 2.8 — Mapper puro de Stage Balance V2.
 */
import type { ReportStageBalanceV2 } from '@/types/reportingV2';

export interface StageBalanceRowView {
  pipelineId: string | null;
  stageId: string | null;
  stageName: string;
  activeCount: number;
  activeValue: number;
  avgDaysInStage: number | null;
}

export interface StageBalanceCards {
  totalActive: number;
  totalValue: number;
  pipelinesAnalyzed: number;
  bottleneckStages: number;
}

export interface StageBalanceView {
  rows: StageBalanceRowView[];
  cards: StageBalanceCards;
}

const BOTTLENECK_THRESHOLD_DAYS = 14;

function mapRow(r: ReportStageBalanceV2): StageBalanceRowView {
  return {
    pipelineId: r.pipeline_id,
    stageId: r.stage_id,
    stageName: r.stage_name ?? '—',
    activeCount: r.active_count ?? 0,
    activeValue: r.active_value ?? 0,
    avgDaysInStage: r.avg_days_in_stage,
  };
}

export function mapStageBalanceV2(raw: ReportStageBalanceV2[] | null | undefined): StageBalanceView {
  const rows = (raw ?? []).map(mapRow);
  const pipelineSet = new Set(rows.map((r) => r.pipelineId).filter(Boolean));
  const cards: StageBalanceCards = {
    totalActive: rows.reduce((s, r) => s + r.activeCount, 0),
    totalValue: rows.reduce((s, r) => s + r.activeValue, 0),
    pipelinesAnalyzed: pipelineSet.size,
    bottleneckStages: rows.filter(
      (r) => r.avgDaysInStage !== null && (r.avgDaysInStage as number) >= BOTTLENECK_THRESHOLD_DAYS,
    ).length,
  };
  return { rows, cards };
}
