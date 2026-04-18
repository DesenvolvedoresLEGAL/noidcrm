/**
 * Sprint 2.8 — Tela V2: SDR Performance.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Trophy, TrendingDown, DollarSign, Target, Clock } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportSDRV2 } from '@/hooks/useReportSDRV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapSdrV2 } from '@/lib/reports/mappers/mapSdrV2';
import { formatCurrency, formatNumber, formatPct } from '@/lib/reports/formatReportNumbers';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function KpiCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}h`;
}

export function SDRPerformanceReportV2() {
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

  const { data, meta, error, isLoading, refetch } = useReportSDRV2({
    organizationId: organization?.id, request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={6} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapSdrV2(data);
  if (view.rows.length === 0) return <ReportEmptyState icon={Users} title="Nenhum SDR encontrado" description="Não há atividade de SDR neste período." />;

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="SDR Performance" />
      <ReportWarningsPanel confidence={meta?.confidence} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={Target} label="SQLs gerados" value={formatNumber(view.totals.totalSqls)} />
        <KpiCard icon={Trophy} label="Ganhos atribuídos" value={formatNumber(view.totals.totalWon)} />
        <KpiCard icon={TrendingDown} label="Perdas atribuídas" value={formatNumber(view.totals.totalLost)} />
        <KpiCard icon={DollarSign} label="Receita atribuída" value={formatCurrency(view.totals.totalRevenue)} />
        <KpiCard icon={Target} label="Win rate" value={formatPct(view.totals.weightedWinRatePct)} />
        <KpiCard icon={Clock} label="Tempo médio qualificação" value={formatHours(view.totals.avgQualificationHours)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">SDRs</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SDR</TableHead>
                <TableHead className="text-right">SQLs</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Perdas</TableHead>
                <TableHead className="text-right">Receita atribuída</TableHead>
                <TableHead className="text-right">Win rate</TableHead>
                <TableHead className="text-right">Tempo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((r) => (
                <TableRow key={r.sdrUserId}>
                  <TableCell className="font-medium">{r.sdrName}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.sqlsGenerated)}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatNumber(r.wonCount)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatNumber(r.lostCount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.revenueAttributed)}</TableCell>
                  <TableCell className="text-right">{formatPct(r.winRatePct)}</TableCell>
                  <TableCell className="text-right">{formatHours(r.avgQualificationHours)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
