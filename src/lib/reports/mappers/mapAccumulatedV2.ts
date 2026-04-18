/**
 * Sprint 2.8 — Mapper puro de Acumuladas V2.
 * Calcula running total como apresentação matemática (não regra de negócio).
 */
import type { ReportAccumulatedV2 } from '@/types/reportingV2';

export interface AccumulatedPointView {
  day: string;
  createdCount: number;
  createdValue: number;
  cumulativeCount: number;
  cumulativeValue: number;
}

export interface AccumulatedCards {
  totalCreated: number;
  totalValue: number;
  avgDailyCount: number;
  avgDailyValue: number;
}

export interface AccumulatedView {
  series: AccumulatedPointView[];
  cards: AccumulatedCards;
}

export function mapAccumulatedV2(raw: ReportAccumulatedV2[] | null | undefined): AccumulatedView {
  const sorted = [...(raw ?? [])].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  let cumCount = 0;
  let cumValue = 0;
  const series: AccumulatedPointView[] = sorted.map((r) => {
    cumCount += r.created_count ?? 0;
    cumValue += r.created_value ?? 0;
    return {
      day: r.day,
      createdCount: r.created_count ?? 0,
      createdValue: r.created_value ?? 0,
      cumulativeCount: cumCount,
      cumulativeValue: cumValue,
    };
  });
  const days = series.length || 1;
  const cards: AccumulatedCards = {
    totalCreated: cumCount,
    totalValue: cumValue,
    avgDailyCount: cumCount / days,
    avgDailyValue: cumValue / days,
  };
  return { series, cards };
}
