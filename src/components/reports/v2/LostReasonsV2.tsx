/**
 * Sprint 2.7 — Tela V2: Motivos de Perda.
 * Consome agregado + detalhe via edge functions V2.
 * Bucket legado é exibido. Não esconde perdas parcialmente classificadas.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingDown, AlertTriangle, ShieldCheck, Shield, Wallet, Activity } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportLossesV2 } from '@/hooks/useReportLossesV2';
import { useReportLossesDetailV2 } from '@/hooks/useReportLossesDetailV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import {
  mapLossesAggregate, mapLossDetail, computeLossesTotals,
} from '@/lib/reports/mappers/mapLossesV2';
import { formatCurrency, formatNumber, formatPct, formatDateBR, formatDays } from '@/lib/reports/formatReportNumbers';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';

function MiniCard({
  icon: Icon, label, value, tone = 'default',
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: 'default' | 'danger' | 'warning' | 'success' }) {
  const cls =
    tone === 'danger' ? 'text-destructive'
    : tone === 'warning' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${cls}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    seller: 'Vendedor',
    client: 'Cliente',
    win_loss: 'Win/Loss',
    none: 'Sem fonte',
  };
  return <Badge variant="outline" className="text-xs">{map[source] ?? source}</Badge>;
}

export function LostReasonsV2() {
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

  const detailRequest = useMemo(() => {
    if (!request) return undefined;
    return { ...request, options: { ...(request.options ?? {}), limit: 200 } };
  }, [request]);

  const aggQuery = useReportLossesV2({ organizationId: organization?.id, request });
  const detQuery = useReportLossesDetailV2({ organizationId: organization?.id, request: detailRequest });

  if (aggQuery.isLoading || detQuery.isLoading || teamVisibility.loading) {
    return <ReportLoadingState cardCount={6} />;
  }
  if (aggQuery.error) {
    return <ReportErrorState message={(aggQuery.error as Error).message} onRetry={() => aggQuery.refetch()} />;
  }

  const agg = mapLossesAggregate(aggQuery.data);
  const totals = computeLossesTotals(agg);
  const detail = mapLossDetail(detQuery.data);

  if (totals.totalLost === 0) {
    return (
      <ReportEmptyState
        icon={TrendingDown}
        title="Nenhuma perda registrada"
        description="Sem perdas no período selecionado."
      />
    );
  }

  // Ranking por motivo consolidado (top 10)
  const ranking = [...agg]
    .sort((a, b) => b.lostCount - a.lostCount)
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={aggQuery.meta} reportLabel="Motivos de Perda" />
      <ReportWarningsPanel confidence={aggQuery.meta?.confidence} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MiniCard icon={TrendingDown} label="Total perdidas" value={formatNumber(totals.totalLost)} tone="danger" />
        <MiniCard icon={Wallet} label="Valor perdido" value={formatCurrency(totals.totalValue)} tone="danger" />
        <MiniCard icon={Activity} label="Ticket médio perdido" value={formatCurrency(totals.avgTicket)} />
        <MiniCard icon={ShieldCheck} label="Cobertura completa" value={formatPct(totals.fullCoveragePct)} tone="success" />
        <MiniCard icon={Shield} label="Qualquer cobertura" value={formatPct(totals.anyCoveragePct)} tone="warning" />
        <MiniCard icon={AlertTriangle} label="Legado não classificado" value={formatPct(totals.legacyUnclassifiedPct)} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking por motivo consolidado</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motivo (id)</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Perdas</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r, i) => (
                <TableRow key={(r.consolidatedLossReasonId ?? 'none') + i}>
                  <TableCell className="font-mono text-xs">{r.consolidatedLossReasonId ?? '— sem motivo'}</TableCell>
                  <TableCell><SourceBadge source={r.lossReasonSource} /></TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{r.classificationStatus ?? '—'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(r.lostCount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.lostValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.avgLostTicket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhe das perdas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oportunidade</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Win/Loss</TableHead>
                <TableHead>Consolidado</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Source valor</TableHead>
                <TableHead>Concorrente</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Ciclo</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Data perda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum detalhe disponível.
                  </TableCell>
                </TableRow>
              ) : detail.map((d) => (
                <TableRow key={d.opportunityId}>
                  <TableCell className="max-w-[200px] truncate font-medium">{d.opportunityTitle ?? d.opportunityId}</TableCell>
                  <TableCell>{d.ownerName ?? '—'}</TableCell>
                  <TableCell>{d.sdrName ?? '—'}</TableCell>
                  <TableCell className="text-xs">{d.sellerReason ?? '—'}</TableCell>
                  <TableCell className="text-xs">{d.clientReason ?? '—'}</TableCell>
                  <TableCell className="text-xs">{d.winLossReason ?? '—'}</TableCell>
                  <TableCell className="text-xs">{d.consolidatedReason ?? '—'}</TableCell>
                  <TableCell><SourceBadge source={d.reasonSource} /></TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(d.lostValue)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.amountSource ?? '—'}</TableCell>
                  <TableCell className="text-xs">{d.competitor ?? '—'}</TableCell>
                  <TableCell className="text-right text-xs">{d.discount !== null ? formatCurrency(d.discount) : '—'}</TableCell>
                  <TableCell className="text-right text-xs">{formatDays(d.cycleDays)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{d.observation ?? '—'}</TableCell>
                  <TableCell className="text-xs">{formatDateBR(d.lostAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
