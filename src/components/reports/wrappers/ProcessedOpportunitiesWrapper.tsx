/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para Processadas.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { ProcessedOpportunitiesV2 } from '@/components/reports/v2/ProcessedOpportunitiesV2';
import { ProcessedOpportunities } from '@/components/reports/ProcessedOpportunities';

export function ProcessedOpportunitiesWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('processed', master, sub)) return <ProcessedOpportunitiesV2 />;
  return <ProcessedOpportunities />;
}
