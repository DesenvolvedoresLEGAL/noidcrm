/**
 * Sprint 2.7 — Tela V2: Visão Geral.
 * Consome edge function `report_summary_v2` via useReportSummaryV2.
 * Zero recálculo de regra crítica.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Trophy, Activity,
  Target, Layers, Wallet,
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportSummaryV2 } from '@/hooks/useReportSummaryV2';
import { useUnifiedWonRevenueV2 } from '@/hooks/useUnifiedWonRevenueV2';
import { useClosedRevenueSummary } from '@/hooks/revenue/useRevenueSsot';
import { RevenueSsotBanner } from '@/components/revenue/RevenueSsotBanner';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapSummaryV2 } from '@/lib/reports/mappers/mapSummaryV2';
import { formatCurrency, formatNumber, formatPct } from '@/lib/reports/formatReportNumbers';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertTriangle } from 'lucide-react';


interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'danger' | 'primary';
}

function KpiCard({ icon: Icon, label, value, hint, tone = 'default' }: KpiCardProps) {
  const toneClass =
    tone === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'danger' ? 'text-destructive'
    : tone === 'primary' ? 'text-primary'
    : 'text-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function GeneralOverviewV2() {
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

  const { data, meta, error, isLoading, refetch } = useReportSummaryV2({
    organizationId: organization?.id,
    request,
  });

  // Sprint 2.10: fonte única de receita ganha (CEO ↔ Reports)
  const { data: unified } = useUnifiedWonRevenueV2(organization?.id);

  // P0 Revenue SSoT — override de receita ganha vem de commercial_won_revenue_view
  const { data: ssotSummary } = useClosedRevenueSummary({
    surface: 'reports-geral-v2',
    organizationId: organization?.id,
    start: effectiveDates.startDate,
    end: effectiveDates.endDate,
    pipelineIds: filters.pipelines?.length ? filters.pipelines : undefined,
    sellerIds: filters.users && filters.users !== 'all' ? [filters.users] : undefined,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={9} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapSummaryV2(data);
  if (!view) {
    return (
      <ReportEmptyState
        icon={BarChart3}
        title="Sem dados para o período selecionado"
        description="Ajuste os filtros de data, pipelines ou usuários e tente novamente."
      />
    );
  }

  // SSoT override (monetário ganho + count + ticket médio ganho)
  const wonCountSsot = ssotSummary?.count ?? view.wonCount;
  const wonRevenueSsot = ssotSummary?.total ?? view.wonRevenue;
  const avgWonTicketSsot = ssotSummary?.avgTicket ?? view.avgWonTicket;


  // Cobertura por proposta para warning executivo
  const totalWonForCoverage = (unified?.won_count_via_accepted_proposal ?? 0)
    + (unified?.won_count_via_latest_proposal ?? 0)
    + (unified?.won_count_via_opportunity_fallback ?? 0)
    + (unified?.won_count_via_zero_fallback ?? 0);
  const proposalBasedPct = totalWonForCoverage > 0
    ? Math.round(((unified?.won_count_via_accepted_proposal ?? 0) + (unified?.won_count_via_latest_proposal ?? 0)) / totalWonForCoverage * 100)
    : 0;
  const lowProposalCoverage = totalWonForCoverage > 0 && proposalBasedPct < 80;

  return (
    <TooltipProvider>


      <div className="space-y-4">
        <ReportMetaBar meta={meta} reportLabel="Visão Geral" />
        <RevenueSsotBanner surface="Relatórios → Geral" />
        <ReportWarningsPanel confidence={meta?.confidence} />

        {/* Sprint 2.11 — escopo all-time vs CEO Dashboard mensal */}
        <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
          <div>
            <strong>Escopo:</strong> esta tela mostra o <strong>histórico completo</strong> de oportunidades ganhas/perdidas da organização.
            O <em>Dashboard CEO</em> mostra apenas o <strong>mês corrente</strong> — os dois usam a mesma cascata monetária (proposta aceita → valor previsto), portanto valores diferentes refletem janelas de tempo diferentes, não cálculos diferentes.
          </div>
        </div>

        {lowProposalCoverage && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <strong>{100 - proposalBasedPct}% das oportunidades ganhas não têm proposta registrada.</strong>{' '}
              A receita destes deals é estimada via valor previsto. Registre propostas formais para aumentar a confiança monetária.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <KpiCard icon={Layers} label="Pipeline ativo" value={formatNumber(view.activePipelineCount)} tone="primary" />
          <KpiCard icon={Wallet} label="Valor do pipeline" value={formatCurrency(view.activePipelineValue)} tone="primary" />
          <KpiCard icon={Trophy} label="Ganhas" value={formatNumber(wonCountSsot)} tone="success" />
          <KpiCard
            icon={DollarSign}
            label="Receita ganha"
            value={formatCurrency(wonRevenueSsot)}
            tone="success"
            hint="commercial_won_revenue_view"
          />
          <KpiCard icon={TrendingDown} label="Perdidas" value={formatNumber(view.lostCount)} tone="danger" />
          <KpiCard icon={Wallet} label="Valor perdido" value={formatCurrency(view.lostValue)} tone="danger" />
          <KpiCard icon={Activity} label="Processadas" value={formatNumber(view.processedCount)} />
          <KpiCard icon={Target} label="Taxa de conversão" value={formatPct(view.winRatePct)} hint="ganhas / processadas" />
          <KpiCard icon={TrendingUp} label="Ticket médio ganho" value={formatCurrency(avgWonTicketSsot)} />
        </div>
      </div>
    </TooltipProvider>
  );
}

