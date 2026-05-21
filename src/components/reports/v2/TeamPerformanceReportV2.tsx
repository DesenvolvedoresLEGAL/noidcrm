/**
 * Sprint 2.7 — Tela V2: Performance da Equipe.
 * Win rate vem da view (sem média aritmética legacy).
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Trophy, TrendingDown, Activity, DollarSign, Target, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportTeamV2 } from '@/hooks/useReportTeamV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapTeamV2, computeTeamTotals } from '@/lib/reports/mappers/mapTeamV2';
import { formatCurrency, formatNumber, formatPct } from '@/lib/reports/formatReportNumbers';
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

export function TeamPerformanceReportV2() {
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

  const { data, meta, error, isLoading, refetch } = useReportTeamV2({
    organizationId: organization?.id,
    request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={6} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const rows = mapTeamV2(data);
  if (rows.length === 0) {
    return (
      <ReportEmptyState
        icon={Users}
        title="Nenhum membro encontrado"
        description="Sem dados de performance para os filtros aplicados."
      />
    );
  }

  const totals = computeTeamTotals(rows);

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Performance Equipe" />
      <ReportWarningsPanel confidence={meta?.confidence} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MiniCard icon={DollarSign} label="Receita ganha" value={formatCurrency(totals.wonRevenue)} />
        <MiniCard icon={Trophy} label="Ganhos" value={formatNumber(totals.wonCount)} />
        <MiniCard icon={TrendingDown} label="Perdidas" value={formatNumber(totals.lostCount)} />
        <MiniCard icon={Activity} label="Ativos" value={formatNumber(totals.activeCount)} />
        <MiniCard icon={Target} label="Win rate oficial" value={formatPct(totals.winRatePct)} />
        <MiniCard icon={Wallet} label="Ticket médio" value={formatCurrency(totals.avgTicket)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipe</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Perdidas</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Pipeline ativo</TableHead>
                <TableHead className="text-right">Win rate</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.ownerUserId}>
                  <TableCell className="font-medium">{r.ownerName ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.wonCount)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.lostCount)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.activeCount)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(r.wonRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.activePipelineValue)}</TableCell>
                  <TableCell className="text-right">{formatPct(r.winRatePct)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.avgWonTicket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
