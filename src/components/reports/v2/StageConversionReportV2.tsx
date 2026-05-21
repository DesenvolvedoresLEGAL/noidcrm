/**
 * Sprint 2.8 — Tela V2: Conversão por Estágio (combinada — estado atual + fluxo histórico).
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Layers, GitMerge } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportStagesV2 } from '@/hooks/useReportStagesV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapStagesV2 } from '@/lib/reports/mappers/mapStagesV2';
import { formatCurrency, formatNumber, formatPct, formatDays } from '@/lib/reports/formatReportNumbers';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';
import { RevenueSsotBanner } from '@/components/revenue/RevenueSsotBanner';

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export function StageConversionReportV2() {
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

  const { balance, conversion, meta, error, isLoading, refetch } = useReportStagesV2({
    organizationId: organization?.id, request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={2} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapStagesV2(balance, conversion);
  if (view.balance.rows.length === 0 && view.conversion.rows.length === 0) {
    return <ReportEmptyState icon={GitMerge} title="Sem dados de estágios" description="Ajuste filtros para visualizar estado atual e fluxo histórico." />;
  }

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Conversão por Estágio" />
      <RevenueSsotBanner variant="legacy" surface="Relatórios → Estágios (totais por etapa não migrados)" />

      <ReportWarningsPanel confidence={meta?.confidence} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Estado atual por estágio
          </CardTitle>
        </CardHeader>
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
              {view.balance.rows.map((r) => (
                <TableRow key={`b-${r.pipelineId}-${r.stageId}`}>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitMerge className="h-4 w-4 text-primary" />
            Fluxo histórico entre estágios
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pipeline</TableHead>
                <TableHead>De</TableHead>
                <TableHead></TableHead>
                <TableHead>Para</TableHead>
                <TableHead className="text-right">Transições</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.conversion.rows.map((r) => (
                <TableRow key={`c-${r.fromStageId}-${r.toStageId}`}>
                  <TableCell className="text-xs text-muted-foreground">{r.pipelineId?.slice(0, 8) ?? '—'}</TableCell>
                  <TableCell className="font-medium">{r.fromStageName}</TableCell>
                  <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                  <TableCell className="font-medium">{r.toStageName}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.transitionCount)}</TableCell>
                  <TableCell className="text-right">{formatPct(r.transitionRatePct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
