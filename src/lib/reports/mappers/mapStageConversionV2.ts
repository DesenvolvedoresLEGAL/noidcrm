/**
 * Sprint 2.8 — Mapper puro de Stage Conversion V2.
 */
import type { ReportStageConversionV2 } from '@/types/reportingV2';

export interface StageConversionRowView {
  pipelineId: string | null;
  fromStageId: string;
  fromStageName: string;
  toStageId: string;
  toStageName: string;
  transitionCount: number;
  transitionRatePct: number | null;
}

export interface StageConversionHighlights {
  totalTransitions: number;
  bestAdvance: StageConversionRowView | null;
  worstStuck: StageConversionRowView | null;
  avgRatePct: number | null;
}

export interface StageConversionView {
  rows: StageConversionRowView[];
  highlights: StageConversionHighlights;
}

function mapRow(r: ReportStageConversionV2): StageConversionRowView {
  return {
    pipelineId: r.pipeline_id,
    fromStageId: r.from_stage_id,
    fromStageName: r.from_stage_name ?? '—',
    toStageId: r.to_stage_id,
    toStageName: r.to_stage_name ?? '—',
    transitionCount: r.transition_count ?? 0,
    transitionRatePct: r.transition_rate_pct,
  };
}

export function mapStageConversionV2(
  raw: ReportStageConversionV2[] | null | undefined,
): StageConversionView {
  const rows = (raw ?? []).map(mapRow);
  const totalTransitions = rows.reduce((s, r) => s + r.transitionCount, 0);
  const bestAdvance = rows.reduce<StageConversionRowView | null>((acc, r) => {
    if (r.transitionRatePct === null) return acc;
    if (!acc || (acc.transitionRatePct ?? -1) < (r.transitionRatePct ?? -1)) return r;
    return acc;
  }, null);
  const worstStuck = rows.reduce<StageConversionRowView | null>((acc, r) => {
    if (r.transitionRatePct === null) return acc;
    if (!acc || (acc.transitionRatePct ?? Infinity) > (r.transitionRatePct ?? Infinity)) return r;
    return acc;
  }, null);
  const validRates = rows.filter((r) => r.transitionRatePct !== null);
  const avgRatePct =
    validRates.length > 0
      ? validRates.reduce((s, r) => s + (r.transitionRatePct as number), 0) / validRates.length
      : null;
  return { rows, highlights: { totalTransitions, bestAdvance, worstStuck, avgRatePct } };
}
