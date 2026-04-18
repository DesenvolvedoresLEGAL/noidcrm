/**
 * Sprint 2.7 — Wrapper de roteamento V2/Legacy para Forecast.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { RevenueForecastV2 } from '@/components/reports/v2/RevenueForecastV2';
import { RevenueForecast } from '@/components/reports/RevenueForecast';

export function RevenueForecastWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('forecast', master, sub)) return <RevenueForecastV2 />;
  return <RevenueForecast />;
}
