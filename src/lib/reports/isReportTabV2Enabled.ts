/**
 * Sprint 2.7 — Resolve flag por aba do relatório.
 * Retorna true só quando master + sub[tab] estão ligados.
 */
import type { ReportsV2SubFlags } from '@/hooks/useReportsV2Flag';

export type ReportV2Tab = keyof ReportsV2SubFlags;

export const REPORT_KEY_TO_FLAG: Record<string, ReportV2Tab> = {
  // Sprint 2.7 (Fase 1)
  general: 'general',
  'lost-reasons': 'losses',
  forecast: 'forecast',
  'closer-performance': 'closer',
  'team-performance': 'team',
  // Sprint 2.8 (Fase 2)
  origins: 'origins',
  processed: 'processed',
  'sdr-performance': 'sdr',
  handoff: 'handoff',
  'funnel-balance': 'stage_balance',
  'conversion-rate': 'stage_conversion',
  'stage-conversion': 'stages',
  accumulated: 'accumulated',
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
