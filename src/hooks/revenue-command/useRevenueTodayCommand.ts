/**
 * Sprint REVOPS V3.1 — Hook agregador da aba "Hoje na Operação"
 *
 * Consome SOMENTE fontes oficiais já existentes:
 *  - commercial_won_revenue_view (via revenueSsotService)
 *  - useForecastData (Forecast oficial)
 *  - useQualificationQualityV2 (Qualidade de qualificação)
 *
 * Não cria nem altera regra financeira. Apenas consolida leitura.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, subDays } from 'date-fns';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useForecastSalesPipeline } from '@/hooks/forecast/useForecastSalesPipeline';
import {
  useClosedRevenueSummary,
  useRevenueBySeller,
} from '@/hooks/revenue/useRevenueSsot';
import { useForecastData } from '@/hooks/useForecastData';
import { useQualificationQualityV2 } from '@/hooks/reports/useQualificationQualityV2';
import { revenueSsotService } from '@/services/revenue/revenueSsotService';

export interface TodayScoreboard {
  validRevenue: number;
  cancelledRevenue: number;
  cancelledCount: number;
  monthlyGoal: number;
  goalAttainmentPct: number | null;
  forecastRealistic: number | null;
  activePipeline: number | null;
  winRate: number | null;
  qualifiedSqls: number | null;
  validCount: number;
}

export interface TodayChange {
  key: string;
  label: string;
  value: number | string;
  helper?: string;
  available: boolean;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface TodayAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  source: string;
  cta?: { label: string; to: string };
}

export interface TodayAction {
  id: string;
  title: string;
  reason: string;
  priority: 'alta' | 'média' | 'baixa';
  to: string;
}

export interface TodayCommandData {
  scoreboard: TodayScoreboard;
  changes: TodayChange[];
  alerts: TodayAlert[];
  nextActions: TodayAction[];
  meta: {
    generatedAt: string;
    period: { start: string; end: string };
    sources: string[];
    partial: boolean;
    failedSources: string[];
  };
}

export function useRevenueTodayCommand() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const now = useMemo(() => new Date(), []);
  const periodStart = useMemo(() => startOfMonth(now), [now]);
  const periodEnd = now;
  const start = periodStart.toISOString();
  const end = periodEnd.toISOString();

  // 3) Forecast oficial — exige sales pipeline resolvido
  const { salesPipelineId, salesPipelineStatus } = useForecastSalesPipeline({
    organizationId: orgId,
  });
  const pipelineResolved = salesPipelineStatus === 'resolved' && !!salesPipelineId;
  const salesPipelineFilter = pipelineResolved && salesPipelineId ? [salesPipelineId] : undefined;

  // 1) Receita válida do mês — fonte oficial (Resultados/Auditoria)
  //    Restrita ao pipeline de vendas (mesma janela que Forecast/OTE/Dashboard).
  const closedSummary = useClosedRevenueSummary({
    surface: 'revenue-command:today',
    organizationId: orgId ?? undefined,
    start,
    end,
    pipelineIds: salesPipelineFilter,
  });

  // 2) Concentração de receita por vendedor (mesmo escopo de pipeline)
  const bySeller = useRevenueBySeller({
    surface: 'revenue-command:today',
    organizationId: orgId ?? undefined,
    start,
    end,
    pipelineIds: salesPipelineFilter,
  });

  const forecast = useForecastData({
    periodType: 'monthly',
    periodStart,
    periodEnd,
    pipelineId: pipelineResolved ? salesPipelineId ?? undefined : undefined,
    enabled: pipelineResolved,
  });

  // 4) Qualidade de qualificação — SQLs no mês
  const qualification = useQualificationQualityV2({
    proposalStatus: 'any',
    includeRemovedUsers: false,
  });

  // 5) Receita adicionada nos últimos 7 dias — leitura paralela do SSoT
  //    (mesmo escopo de pipeline para consistência com Forecast/OTE/Dashboard)
  const last7Start = useMemo(() => subDays(now, 7).toISOString(), [now]);
  const last7Summary = useQuery({
    queryKey: ['revenue-command:last7', orgId, last7Start, end, salesPipelineFilter?.[0] ?? null],
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: () =>
      revenueSsotService.getClosedRevenueSummary({
        organizationId: orgId!,
        start: last7Start,
        end,
        pipelineIds: salesPipelineFilter ?? null,
      }),
  });

  return useMemo<{
    data: TodayCommandData | null;
    isLoading: boolean;
    error: Error | null;
  }>(() => {
    const isLoading =
      closedSummary.isLoading ||
      qualification.isLoading ||
      (pipelineResolved && forecast.isLoading);

    const failedSources: string[] = [];
    if (closedSummary.error) failedSources.push('Resultados/Auditoria');
    if (qualification.error) failedSources.push('Qualidade de Qualificação');
    if (forecast.error) failedSources.push('Forecast');
    if (bySeller.error) failedSources.push('Receita por vendedor');
    if (last7Summary.error) failedSources.push('Receita 7d');

    // Sem org → não renderiza
    if (!orgId) {
      return { data: null, isLoading: true, error: null };
    }

    const closed = closedSummary.data ?? null;
    const qual = qualification.data ?? null;
    const fc = forecast.kpis ?? null;
    const realisticScenario = forecast.scenarios?.find(
      (s) => s.name === 'realistic',
    );

    const validRevenue = closed?.validTotal ?? 0;
    const cancelledRevenue = closed?.cancelledTotal ?? 0;
    const cancelledCount = closed?.cancelledCount ?? 0;
    const validCount = closed?.validCount ?? 0;

    const monthlyGoal = fc?.goal ?? 0;
    const goalAttainmentPct =
      monthlyGoal > 0 ? (validRevenue / monthlyGoal) * 100 : null;

    const scoreboard: TodayScoreboard = {
      validRevenue,
      cancelledRevenue,
      cancelledCount,
      monthlyGoal,
      goalAttainmentPct,
      forecastRealistic: realisticScenario?.value ?? null,
      activePipeline: fc?.totalPipeline ?? null,
      winRate: fc?.winRate ?? null,
      qualifiedSqls: qual?.summary.qualified_count ?? null,
      validCount,
    };

    // What changed
    const changes: TodayChange[] = [
      {
        key: 'new_valid_sales',
        label: 'Novas vendas válidas',
        value: validCount,
        helper: 'no período',
        available: !!closed,
      },
      {
        key: 'new_sqls',
        label: 'Novos SQLs qualificados',
        value: qual?.summary.qualified_count ?? 0,
        helper: 'no período',
        available: !!qual,
      },
      {
        key: 'new_proposals',
        label: 'Novas propostas geradas',
        value: qual?.summary.with_proposal_count ?? 0,
        helper: 'a partir de SQLs',
        available: !!qual,
      },
      {
        key: 'new_losses',
        label: 'Novas perdas registradas',
        value: qual?.summary.lost_count ?? 0,
        helper: 'no período',
        available: !!qual,
      },
      {
        key: 'new_cancellations',
        label: 'Novos cancelamentos',
        value: cancelledCount,
        helper: 'no período',
        available: !!closed,
      },
      {
        key: 'revenue_7d',
        label: 'Receita nos últimos 7 dias',
        value: last7Summary.data?.validTotal ?? 0,
        helper: 'vendas válidas',
        available: !!last7Summary.data,
      },
    ];

    // Alertas
    const alerts: TodayAlert[] = [];

    // Meta em risco: proporcional ao mês
    if (monthlyGoal > 0) {
      const totalDays =
        Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86_400_000)) + 1;
      const daysElapsed = Math.max(1, Math.ceil((now.getTime() - periodStart.getTime()) / 86_400_000));
      const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const expected = monthlyGoal * (daysElapsed / monthDays);
      const realistic = realisticScenario?.value ?? validRevenue;
      if (realistic < monthlyGoal && validRevenue < expected) {
        const gap = monthlyGoal - realistic;
        alerts.push({
          id: 'goal-at-risk',
          title: 'Meta do mês em risco',
          description:
            gap > 0
              ? `Forecast realista R$${Math.round(realistic).toLocaleString('pt-BR')} abaixo da meta em R$${Math.round(gap).toLocaleString('pt-BR')}.`
              : 'Realizado abaixo do esperado para o dia do mês.',
          severity: gap / monthlyGoal > 0.2 ? 'critical' : 'warning',
          source: 'Forecast + Resultados',
          cta: { label: 'Abrir Forecast', to: '/app/forecast' },
        });
      }
    }

    // SQLs sem proposta
    const withoutProposal = qual?.summary.without_proposal_count ?? 0;
    if (withoutProposal > 0) {
      alerts.push({
        id: 'sqls-without-proposal',
        title: `${withoutProposal} SQLs sem proposta`,
        description: 'Leads qualificados que ainda não viraram proposta.',
        severity: withoutProposal >= 10 ? 'warning' : 'info',
        source: 'Qualidade de Qualificação',
        cta: { label: 'Ver Qualidade Qualif.', to: '/app/objetivos/desempenho' },
      });
    }

    // Perdas recentes
    const lostCount = qual?.summary.lost_count ?? 0;
    if (lostCount > 0) {
      alerts.push({
        id: 'recent-losses',
        title: `${lostCount} perdas no período`,
        description: 'Oportunidades classificadas como perdidas no recorte.',
        severity: lostCount >= 5 ? 'warning' : 'info',
        source: 'Win/Loss',
        cta: { label: 'Abrir Win/Loss', to: '/app/intelligence/winloss' },
      });
    }

    // Cancelamentos
    if (cancelledCount > 0) {
      alerts.push({
        id: 'cancellations',
        title: `${cancelledCount} vendas canceladas`,
        description: `Receita cancelada de R$${Math.round(cancelledRevenue).toLocaleString('pt-BR')} no período.`,
        severity: 'warning',
        source: 'Resultados / Auditoria',
        cta: { label: 'Abrir Auditoria', to: '/app/objetivos/resultados' },
      });
    }

    // Forecast confidence
    if (fc?.nrhsAverage !== undefined && fc.nrhsAverage > 0 && fc.nrhsConfidence === 'low') {
      alerts.push({
        id: 'forecast-confidence-low',
        title: 'Forecast com confiança baixa',
        description: `Índice NRHS médio em ${fc.nrhsAverage.toFixed(0)}%.`,
        severity: 'warning',
        source: 'Forecast',
        cta: { label: 'Abrir Forecast', to: '/app/forecast' },
      });
    } else if (fc?.nrhsConfidence === 'very_low') {
      alerts.push({
        id: 'forecast-confidence-vlow',
        title: 'Forecast com confiança muito baixa',
        description: 'Higiene do pipeline insuficiente para previsão confiável.',
        severity: 'critical',
        source: 'Forecast',
        cta: { label: 'Abrir Forecast', to: '/app/forecast' },
      });
    }

    // Concentração de receita
    const sellers = bySeller.data ?? [];
    if (sellers.length > 1 && validRevenue > 0) {
      const top = sellers[0];
      const share = top.total / validRevenue;
      if (share > 0.7) {
        alerts.push({
          id: 'revenue-concentration',
          title: 'Receita concentrada',
          description: `${top.label} responde por ${(share * 100).toFixed(0)}% da receita válida.`,
          severity: 'warning',
          source: 'Resultados',
          cta: { label: 'Abrir Desempenho', to: '/app/objetivos/desempenho' },
        });
      }
    }

    // Next actions baseadas nos alertas
    const nextActions: TodayAction[] = [];
    if (withoutProposal > 0) {
      nextActions.push({
        id: 'review-sqls',
        title: 'Revisar SQLs sem proposta',
        reason: `${withoutProposal} leads qualificados aguardando proposta.`,
        priority: withoutProposal >= 10 ? 'alta' : 'média',
        to: '/app/objetivos/desempenho',
      });
    }
    if (monthlyGoal > 0 && alerts.some((a) => a.id === 'goal-at-risk')) {
      nextActions.push({
        id: 'prioritize-forecast',
        title: 'Priorizar oportunidades do forecast',
        reason: 'Realista abaixo da meta — atuar nos commits do mês.',
        priority: 'alta',
        to: '/app/forecast',
      });
    }
    if (cancelledCount > 0) {
      nextActions.push({
        id: 'audit-cancellations',
        title: 'Auditar vendas canceladas',
        reason: `${cancelledCount} cancelamento(s) no período.`,
        priority: 'alta',
        to: '/app/objetivos/resultados',
      });
    }
    if (lostCount > 0) {
      nextActions.push({
        id: 'review-losses',
        title: 'Revisar perdas recentes',
        reason: `${lostCount} perda(s) classificada(s) no período.`,
        priority: lostCount >= 5 ? 'alta' : 'média',
        to: '/app/intelligence/winloss',
      });
    }
    if (alerts.some((a) => a.id === 'revenue-concentration')) {
      nextActions.push({
        id: 'check-concentration',
        title: 'Checar concentração de receita',
        reason: 'Risco operacional: receita dependente de um vendedor.',
        priority: 'média',
        to: '/app/objetivos/desempenho',
      });
    }

    const data: TodayCommandData = {
      scoreboard,
      changes,
      alerts,
      nextActions,
      meta: {
        generatedAt: new Date().toISOString(),
        period: { start, end },
        sources: ['Resultados', 'Forecast', 'Desempenho', 'Win/Loss', 'Qualidade Qualif.'],
        partial: failedSources.length > 0,
        failedSources,
      },
    };

    return { data, isLoading, error: null };
  }, [
    orgId,
    closedSummary.data,
    closedSummary.error,
    closedSummary.isLoading,
    bySeller.data,
    bySeller.error,
    pipelineResolved,
    forecast.kpis,
    forecast.scenarios,
    forecast.error,
    forecast.isLoading,
    qualification.data,
    qualification.error,
    qualification.isLoading,
    last7Summary.data,
    last7Summary.error,
    start,
    end,
    now,
    periodStart,
    periodEnd,
  ]);
}
