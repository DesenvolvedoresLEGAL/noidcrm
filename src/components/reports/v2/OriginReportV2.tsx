/**
 * Sprint 2.8 — Tela V2: Origens.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Trophy, DollarSign, Target } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportOriginsV2 } from '@/hooks/useReportOriginsV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapOriginsV2 } from '@/lib/reports/mappers/mapOriginsV2';
import { formatCurrency, formatNumber, formatPct } from '@/lib/reports/formatReportNumbers';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function KpiCard({ icon: Icon, label, value, hint }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function OriginReportV2() {
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

  const { data, meta, error, isLoading, refetch } = useReportOriginsV2({
    organizationId: organization?.id, request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={4} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapOriginsV2(data);
  if (view.rows.length === 0) {
    return <ReportEmptyState icon={Globe} title="Nenhuma origem encontrada" description="Ajuste os filtros para visualizar origens neste período." />;
  }

  const { highlights, rows } = view;

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Origens" />
      <ReportWarningsPanel confidence={meta?.confidence} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Globe} label="Origens ativas" value={formatNumber(highlights.totalOrigins)} />
        <KpiCard icon={Trophy} label="Mais oportunidades" value={highlights.topByVolume?.originName ?? '—'} hint={highlights.topByVolume ? `${formatNumber(highlights.topByVolume.totalCount)} oportunidades` : undefined} />
        <KpiCard icon={DollarSign} label="Maior receita" value={highlights.topByRevenue?.originName ?? '—'} hint={highlights.topByRevenue ? formatCurrency(highlights.topByRevenue.wonRevenue) : undefined} />
        <KpiCard icon={Target} label="Melhor conversão" value={highlights.topByWinRate?.originName ?? '—'} hint={highlights.topByWinRate ? formatPct(highlights.topByWinRate.winRatePct) : undefined} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Detalhamento por origem</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ganhas</TableHead>
                <TableHead className="text-right">Perdidas</TableHead>
                <TableHead className="text-right">Abertas</TableHead>
                <TableHead className="text-right">Receita ganha</TableHead>
                <TableHead className="text-right">Pipeline aberto</TableHead>
                <TableHead className="text-right">Win rate</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.originName}>
                  <TableCell className="font-medium">{r.originName}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.totalCount)}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatNumber(r.wonCount)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatNumber(r.lostCount)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.openCount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.wonRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.openPipelineValue)}</TableCell>
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
