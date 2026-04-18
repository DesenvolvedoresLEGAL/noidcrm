/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para Origens.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { OriginReportV2 } from '@/components/reports/v2/OriginReportV2';
import { OriginReport } from '@/components/reports/OriginReport';

export function OriginReportWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('origins', master, sub)) return <OriginReportV2 />;
  return <OriginReport />;
}
