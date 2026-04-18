/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para Handoff.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { HandoffReportV2 } from '@/components/reports/v2/HandoffReportV2';
import { HandoffReport } from '@/components/reports/HandoffReport';

export function HandoffWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('handoff', master, sub)) return <HandoffReportV2 />;
  return <HandoffReport />;
}
