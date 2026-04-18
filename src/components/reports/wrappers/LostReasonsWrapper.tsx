/**
 * Sprint 2.7 — Wrapper de roteamento V2/Legacy para Motivos de Perda.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { LostReasonsV2 } from '@/components/reports/v2/LostReasonsV2';
import { LostReasons } from '@/components/reports/LostReasons';

export function LostReasonsWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('lost-reasons', master, sub)) return <LostReasonsV2 />;
  return <LostReasons />;
}
