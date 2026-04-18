/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para Acumuladas.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { AccumulatedOpportunitiesV2 } from '@/components/reports/v2/AccumulatedOpportunitiesV2';
import { AccumulatedOpportunities } from '@/components/reports/AccumulatedOpportunities';

export function AccumulatedOpportunitiesWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('accumulated', master, sub)) return <AccumulatedOpportunitiesV2 />;
  return <AccumulatedOpportunities />;
}
