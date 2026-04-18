/**
 * Sprint 2.7 — Wrapper de roteamento V2/Legacy para Performance Equipe.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { TeamPerformanceReportV2 } from '@/components/reports/v2/TeamPerformanceReportV2';
import { TeamPerformanceReport } from '@/components/reports/TeamPerformanceReport';

export function TeamPerformanceWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('team-performance', master, sub)) return <TeamPerformanceReportV2 />;
  return <TeamPerformanceReport />;
}
