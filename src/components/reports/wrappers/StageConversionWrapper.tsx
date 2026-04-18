/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para Conversão por Estágio.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { StageConversionReportV2 } from '@/components/reports/v2/StageConversionReportV2';
import { StageConversionReport } from '@/components/reports/StageConversionReport';

export function StageConversionWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('stage-conversion', master, sub)) return <StageConversionReportV2 />;
  return <StageConversionReport />;
}
