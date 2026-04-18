/**
 * Sprint 2.8 — Tela V2: Taxa de Conversão (histórico de transições).
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, TrendingDown, Target, GitMerge } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportStageConversionV2 } from '@/hooks/useReportStageConversionV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapStageConversionV2 } from '@/lib/reports/mappers/mapStageConversionV2';
import { formatNumber, formatPct } from '@/lib/reports/formatReportNumbers';
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

export function ConversionRateV2() {
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

  const { data, meta, error, isLoading, refetch } = useReportStageConversionV2({
    organizationId: organization?.id, request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={4} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapStageConversionV2(data);
  if (view.rows.length === 0) return <ReportEmptyState icon={GitMerge} title="Sem transições no período" description="Não foram observadas mudanças de estágio neste recorte." />;

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Taxa de Conversão" />
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
          Conversão histórica real
        </Badge>
      </div>
      <ReportWarningsPanel confidence={meta?.confidence} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={GitMerge} label="Transições observadas" value={formatNumber(view.highlights.totalTransitions)} />
        <KpiCard icon={TrendingUp} label="Melhor avanço" value={view.highlights.bestAdvance ? formatPct(view.highlights.bestAdvance.transitionRatePct) : '—'} hint={view.highlights.bestAdvance ? `${view.highlights.bestAdvance.fromStageName} → ${view.highlights.bestAdvance.toStageName}` : undefined} />
        <KpiCard icon={TrendingDown} label="Maior travamento" value={view.highlights.worstStuck ? formatPct(view.highlights.worstStuck.transitionRatePct) : '—'} hint={view.highlights.worstStuck ? `${view.highlights.worstStuck.fromStageName} → ${view.highlights.worstStuck.toStageName}` : undefined} />
        <KpiCard icon={Target} label="Taxa média" value={formatPct(view.highlights.avgRatePct)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Transições entre estágios</CardTitle></CardHeader>
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
              {view.rows.map((r) => (
                <TableRow key={`${r.fromStageId}-${r.toStageId}`}>
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
