/**
 * Sprint 2.8 — Tela V2: Oportunidades Processadas.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Trophy, DollarSign, TrendingDown, TrendingUp, Target, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportProcessedV2 } from '@/hooks/useReportProcessedV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapProcessedV2 } from '@/lib/reports/mappers/mapProcessedV2';
import { formatCurrency, formatNumber, formatPct } from '@/lib/reports/formatReportNumbers';
import { useClosedRevenueSummary } from '@/hooks/revenue/useRevenueSsot';
import { RevenueSsotBanner } from '@/components/revenue/RevenueSsotBanner';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';


function KpiCard({ icon: Icon, label, value, tone = 'default' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  const toneClass = tone === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent><div className={`text-2xl font-bold ${toneClass}`}>{value}</div></CardContent>
    </Card>
  );
}

export function ProcessedOpportunitiesV2() {
  const { organization } = useCurrentUser();
  const { filters, effectiveDates } = useReportFiltersContext();
  const teamVisibility = useTeamVisibility();

  const request = useMemo(() => {
    if (!organization?.id || teamVisibility.loading) return undefined;
    return buildReportV2RequestFromFilters({
      organizationId: organization.id,
      filters, effectiveDates,
      teamVisibility: { enabled: !teamVisibility.canViewAll, visibleUserIds: teamVisibility.visibleUserIds },
    });
  }, [organization?.id, filters, effectiveDates, teamVisibility]);

  const { data, meta, error, isLoading, refetch } = useReportProcessedV2({
    organizationId: organization?.id, request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={8} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapProcessedV2(data);
  if (!view) return <ReportEmptyState icon={Activity} title="Sem oportunidades processadas" description="Ajuste o período para visualizar oportunidades fechadas." />;

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Processadas" />
      <ReportWarningsPanel confidence={meta?.confidence} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Activity} label="Total processadas" value={formatNumber(view.processedCount)} />
        <KpiCard icon={Trophy} label="Ganhas" value={formatNumber(view.wonCount)} tone="success" />
        <KpiCard icon={DollarSign} label="Receita ganha" value={formatCurrency(view.wonRevenue)} tone="success" />
        <KpiCard icon={TrendingUp} label="Ticket médio ganho" value={formatCurrency(view.avgWonTicket)} tone="success" />
        <KpiCard icon={TrendingDown} label="Perdidas" value={formatNumber(view.lostCount)} tone="danger" />
        <KpiCard icon={Wallet} label="Valor perdido" value={formatCurrency(view.lostValue)} tone="danger" />
        <KpiCard icon={TrendingDown} label="Ticket médio perdido" value={formatCurrency(view.avgLostTicket)} tone="danger" />
        <KpiCard icon={Target} label="Taxa de conversão" value={formatPct(view.winRatePct)} />
      </div>
    </div>
  );
}
