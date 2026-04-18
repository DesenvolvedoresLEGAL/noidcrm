/**
 * Sprint 2.8 — Wrapper de roteamento V2/Legacy para Balanceamento de Funil.
 */
import { useReportsV2Flag } from '@/hooks/useReportsV2Flag';
import { isReportTabV2Enabled } from '@/lib/reports/isReportTabV2Enabled';
import { FunnelBalanceV2 } from '@/components/reports/v2/FunnelBalanceV2';
import { FunnelBalance } from '@/components/reports/FunnelBalance';

export function FunnelBalanceWrapper() {
  const { master, sub, loading } = useReportsV2Flag();
  if (loading) return null;
  if (isReportTabV2Enabled('funnel-balance', master, sub)) return <FunnelBalanceV2 />;
  return <FunnelBalance />;
}
