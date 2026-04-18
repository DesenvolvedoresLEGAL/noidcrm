/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para Taxa de Conversão.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { ConversionRateV2 } from '@/components/reports/v2/ConversionRateV2';
import { ConversionRate } from '@/components/reports/ConversionRate';

export function ConversionRateWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('conversion-rate', master, sub)) return <ConversionRateV2 />;
  return <ConversionRate />;
}
