/**
 * Sprint 2.7 — Resolve flag por aba do relatório.
 * Retorna true só quando master + sub[tab] estão ligados.
 */
import type { ReportsV2SubFlags } from '@/hooks/useReportsV2Flag';

export type ReportV2Tab = keyof ReportsV2SubFlags;

export const REPORT_KEY_TO_FLAG: Record<string, ReportV2Tab> = {
  general: 'general',
  'lost-reasons': 'losses',
  forecast: 'forecast',
  'closer-performance': 'closer',
  'team-performance': 'team',
  'funnel-balance': 'stage_metrics',
  'stage-conversion': 'stage_metrics',
};

export function isReportTabV2Enabled(
  tab: ReportV2Tab | string,
  master: boolean,
  sub: ReportsV2SubFlags,
): boolean {
  if (!master) return false;
  const key = (REPORT_KEY_TO_FLAG[tab] ?? tab) as ReportV2Tab;
  return Boolean(sub[key]);
}
