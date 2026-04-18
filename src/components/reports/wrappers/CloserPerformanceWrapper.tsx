/**
 * Sprint 2.7 — Wrapper de roteamento V2/Legacy para Performance Closer.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { CloserPerformanceReportV2 } from '@/components/reports/v2/CloserPerformanceReportV2';
import { CloserPerformanceReport } from '@/components/reports/CloserPerformanceReport';

export function CloserPerformanceWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('closer-performance', master, sub)) return <CloserPerformanceReportV2 />;
  return <CloserPerformanceReport />;
}
