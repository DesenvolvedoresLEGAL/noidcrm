/**
 * Sprint 2.7 — Tela V2: Performance Closer.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, TrendingDown, Activity, DollarSign, Target, Clock, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportCloserV2 } from '@/hooks/useReportCloserV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapCloserV2, computeCloserTotals } from '@/lib/reports/mappers/mapCloserV2';
import { formatCurrency, formatNumber, formatPct, formatDays } from '@/lib/reports/formatReportNumbers';
import { useClosedRevenueSummary, useRevenueBySeller } from '@/hooks/revenue/useRevenueSsot';
import { RevenueSsotBanner } from '@/components/revenue/RevenueSsotBanner';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';


function MiniCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function CloserPerformanceReportV2() {
  const { organization } = useCurrentUser();
  const { filters, effectiveDates } = useReportFiltersContext();
  const teamVisibility = useTeamVisibility();

  const request = useMemo(() => {
    if (!organization?.id || teamVisibility.loading) return undefined;
    return buildReportV2RequestFromFilters({
      organizationId: organization.id,
      filters,
      effectiveDates,
      teamVisibility: {
        enabled: !teamVisibility.canViewAll,
        visibleUserIds: teamVisibility.visibleUserIds,
      },
    });
  }, [organization?.id, filters, effectiveDates, teamVisibility]);

  const { data, meta, error, isLoading, refetch } = useReportCloserV2({
    organizationId: organization?.id,
    request,
  });

  const { data: ssotSummary } = useClosedRevenueSummary({
    surface: 'reports-closer-v2-totals',
    organizationId: organization?.id,
    start: effectiveDates.startDate,
    end: effectiveDates.endDate,
    pipelineIds: filters.pipelines?.length ? filters.pipelines : undefined,
    sellerIds: filters.users && filters.users !== 'all' ? [filters.users] : undefined,
  });
  const { data: bySeller } = useRevenueBySeller({
    surface: 'reports-closer-v2-per-seller',
    organizationId: organization?.id,
    start: effectiveDates.startDate,
    end: effectiveDates.endDate,
    pipelineIds: filters.pipelines?.length ? filters.pipelines : undefined,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={7} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const rows = mapCloserV2(data);
  if (rows.length === 0) {
    return (
      <ReportEmptyState
        icon={Trophy}
        title="Nenhum closer encontrado"
        description="Não há fechamentos no período selecionado."
      />
    );
  }

  const totals = computeCloserTotals(rows);
  const sellerMap = new Map((bySeller ?? []).map((g) => [g.key, g] as const));
  const wonRevenueSsot = ssotSummary?.total ?? totals.wonRevenue;
  const wonCountSsot = ssotSummary?.count ?? totals.wonCount;
  const avgTicketSsot = ssotSummary?.avgTicket ?? totals.avgTicket;

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Performance Closer" />
      <RevenueSsotBanner surface="Relatórios → Closer" />
      <ReportWarningsPanel confidence={meta?.confidence} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MiniCard icon={DollarSign} label="Receita ganha" value={formatCurrency(wonRevenueSsot)} />
        <MiniCard icon={Trophy} label="Ganhos" value={formatNumber(wonCountSsot)} />
        <MiniCard icon={TrendingDown} label="Perdidas" value={formatNumber(totals.lostCount)} />
        <MiniCard icon={Activity} label="Ativos" value={formatNumber(totals.activeCount)} />
        <MiniCard icon={Target} label="Win rate" value={formatPct(totals.winRatePct)} />
        <MiniCard icon={Wallet} label="Ticket médio" value={formatCurrency(avgTicketSsot)} />
        <MiniCard icon={Clock} label="Ciclo médio" value={formatDays(totals.avgCycleDays)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Closers</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Perdidas</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Pipeline ativo</TableHead>
                <TableHead className="text-right">Win rate</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead className="text-right">Ciclo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ssot = sellerMap.get(r.closerUserId);
                const wonCount = ssot?.count ?? r.wonCount;
                const wonRev = ssot?.total ?? r.wonRevenue;
                const avgTk = ssot?.avgTicket ?? r.avgWonTicket;
                return (
                  <TableRow key={r.closerUserId}>
                    <TableCell className="font-medium">{r.closerName ?? '—'}</TableCell>
                    <TableCell className="text-right">{formatNumber(wonCount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.lostCount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.activeCount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(wonRev)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.activePipelineValue)}</TableCell>
                    <TableCell className="text-right">{formatPct(r.winRatePct)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(avgTk)}</TableCell>
                    <TableCell className="text-right">{formatDays(r.avgSalesCycleDays)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

