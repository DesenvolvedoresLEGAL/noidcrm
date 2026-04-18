/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para SDR Performance.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { SDRPerformanceReportV2 } from '@/components/reports/v2/SDRPerformanceReportV2';
import { SDRPerformanceReport } from '@/components/reports/SDRPerformanceReport';

export function SDRPerformanceWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('sdr-performance', master, sub)) return <SDRPerformanceReportV2 />;
  return <SDRPerformanceReport />;
}
