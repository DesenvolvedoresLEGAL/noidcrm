/**
 * Sprint 2.7 — Wrapper de roteamento V2/Legacy para Visão Geral.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { GeneralOverviewV2 } from '@/components/reports/v2/GeneralOverviewV2';
import { GeneralOverview } from '@/components/reports/GeneralOverview';

export function GeneralOverviewWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('general', master, sub)) return <GeneralOverviewV2 />;
  return <GeneralOverview data={null} />;
}
