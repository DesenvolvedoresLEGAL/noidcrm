/**
 * Sprint 2.8 — Tela V2: Balanceamento de Funil.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Wallet, GitBranch, AlertTriangle } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportStageBalanceV2 } from '@/hooks/useReportStageBalanceV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapStageBalanceV2 } from '@/lib/reports/mappers/mapStageBalanceV2';
import { formatCurrency, formatNumber, formatDays } from '@/lib/reports/formatReportNumbers';
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

export function FunnelBalanceV2() {
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

  const { data, meta, error, isLoading, refetch } = useReportStageBalanceV2({
    organizationId: organization?.id, request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={4} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapStageBalanceV2(data);
  if (view.rows.length === 0) return <ReportEmptyState icon={Layers} title="Nenhum estágio com oportunidades" description="Não há oportunidades ativas neste recorte." />;

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Balanceamento de Funil" />
      <ReportWarningsPanel confidence={meta?.confidence} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Layers} label="Oportunidades ativas" value={formatNumber(view.cards.totalActive)} />
        <KpiCard icon={Wallet} label="Valor total ativo" value={formatCurrency(view.cards.totalValue)} />
        <KpiCard icon={GitBranch} label="Pipelines analisados" value={formatNumber(view.cards.pipelinesAnalyzed)} />
        <KpiCard icon={AlertTriangle} label="Estágios com gargalo" value={formatNumber(view.cards.bottleneckStages)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Estágios</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pipeline</TableHead>
                <TableHead>Estágio</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Valor ativo</TableHead>
                <TableHead className="text-right">Dias médios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((r) => (
                <TableRow key={`${r.pipelineId}-${r.stageId}`}>
                  <TableCell className="text-xs text-muted-foreground">{r.pipelineId?.slice(0, 8) ?? '—'}</TableCell>
                  <TableCell className="font-medium">{r.stageName}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.activeCount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.activeValue)}</TableCell>
                  <TableCell className="text-right">{formatDays(r.avgDaysInStage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
