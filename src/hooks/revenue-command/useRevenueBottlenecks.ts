/**
 * Sprint REVOPS V3.2 — Hook agregador da aba "Gargalos"
 *
 * Consome SOMENTE fontes oficiais já existentes:
 *  - useQualificationQualityV2 (Qualidade de Qualificação)
 *  - useWinLossData (Win/Loss oficial)
 *  - useClosedRevenueSummary (Resultados/Auditoria via commercial_won_revenue_view)
 *  - useForecastData + useForecastSalesPipeline (Forecast oficial)
 *  - Consulta direta a `proposals` e `opportunities` apenas para leitura.
 *
 * Nenhuma view, edge function ou regra financeira é criada ou alterada.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useQualificationQualityV2 } from '@/hooks/reports/useQualificationQualityV2';
import { useWinLossData } from '@/hooks/useWinLossData';
import { useClosedRevenueSummary } from '@/hooks/revenue/useRevenueSsot';
import { useForecastSalesPipeline } from '@/hooks/forecast/useForecastSalesPipeline';
import { useForecastData } from '@/hooks/useForecastData';

export interface FunnelLeak {
  id: 'sqls_without_proposal' | 'open_proposals' | 'lost_proposals' | 'cancelled_sales';
  label: string;
  count: number;
  value: number | null;
  helper?: string;
  source: string;
  cta: { label: string; to: string };
  available: boolean;
}

export interface DeathStage {
  stageId: string;
  stageName: string;
  count: number;
  pct: number;
  lostValue: number;
}

export interface LossReasonItem {
  reason: string;
  count: number;
  pct: number;
  lostValue: number;
}

export interface SpeedMetric {
  id: string;
  label: string;
  days: number | null;
  hours: number | null;
  available: boolean;
  helper?: string;
}

export interface RevenueRiskItem {
  id: 'open_proposals' | 'pipeline_open' | 'forecast_dependent';
  label: string;
  value: number;
  helper?: string;
  available: boolean;
}

export interface BottlenecksData {
  funnelLeaks: FunnelLeak[];
  deathStages: DeathStage[];
  lossReasons: LossReasonItem[];
  speedMetrics: SpeedMetric[];
  revenueRisk: RevenueRiskItem[];
  executiveSummary: string;
  scope: {
    label: string;
    pipelineId: string | null;
    pipelineName: string | null;
    resolved: boolean;
  };
  meta: {
    generatedAt: string;
    period: { start: string; end: string };
    sources: string[];
    partial: boolean;
    failedSources: string[];
  };
}

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function useRevenueBottlenecks() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const now = useMemo(() => new Date(), []);
  const periodStart = useMemo(() => startOfMonth(now), [now]);
  const periodEnd = now;
  const start = periodStart.toISOString();
  const end = periodEnd.toISOString();

  // 1) Qualidade de Qualificação — SQLs e tempos
  const qualification = useQualificationQualityV2({
    proposalStatus: 'any',
    includeRemovedUsers: false,
  });

  // 2) Forecast pipeline (necessário para Win/Loss e Forecast)
  const { salesPipelineId, salesPipelineName, salesPipelineStatus } = useForecastSalesPipeline({
    organizationId: orgId,
  });
  const pipelineResolved = salesPipelineStatus === 'resolved' && !!salesPipelineId;

  // 3) Win/Loss oficial — death stages e motivos
  const winLoss = useWinLossData(
    orgId ?? undefined,
    salesPipelineId ?? null,
    { from: periodStart, to: periodEnd },
  );

  // 4) Receita válida / cancelada — Resultados/Auditoria (SSoT)
  const closedSummary = useClosedRevenueSummary({
    surface: 'revenue-command:bottlenecks',
    organizationId: orgId ?? undefined,
    start,
    end,
  });

  // 5) Forecast oficial
  const forecast = useForecastData({
    periodType: 'monthly',
    periodStart,
    periodEnd,
    pipelineId: pipelineResolved ? salesPipelineId ?? undefined : undefined,
    enabled: pipelineResolved,
  });

  // 6) Propostas abertas/rejeitadas — leitura direta
  // HOTFIX V3.1A: escopo restrito ao pipeline comercial de Vendas (mesma
  // referência usada pelo Forecast). Propostas/oportunidades de Pré-vendas,
  // Operacional, Remarketing etc. são excluídas do Revenue Command Center.
  const proposalsAggr = useQuery({
    queryKey: ['revenue-command:bottlenecks:proposals', orgId, salesPipelineId, start, end],
    enabled: !!orgId && pipelineResolved,
    staleTime: 60_000,
    queryFn: async () => {
      // Abertas (sent) — qualquer data, somente pipeline de Vendas
      const openQ = await supabase
        .from('proposals')
        .select('id, total_amount, sent_at, created_at, opportunities!inner(pipeline_id)')
        .eq('organization_id', orgId!)
        .eq('status', 'sent')
        .eq('opportunities.pipeline_id', salesPipelineId!);
      if (openQ.error) throw openQ.error;

      // Rejeitadas no período — somente pipeline de Vendas
      const lostQ = await supabase
        .from('proposals')
        .select('id, total_amount, opportunities!inner(pipeline_id)')
        .eq('organization_id', orgId!)
        .eq('status', 'rejected')
        .eq('opportunities.pipeline_id', salesPipelineId!)
        .gte('created_at', start)
        .lte('created_at', end);
      if (lostQ.error) throw lostQ.error;

      const open = openQ.data ?? [];
      const lost = lostQ.data ?? [];

      const openValue = open.reduce((s, p: any) => s + (Number(p.total_amount) || 0), 0);
      const lostValue = lost.reduce((s, p: any) => s + (Number(p.total_amount) || 0), 0);

      const nowMs = now.getTime();
      const ages = open
        .map((p: any) => {
          const ref = p.sent_at || p.created_at;
          if (!ref) return null;
          return Math.max(0, (nowMs - new Date(ref).getTime()) / 86_400_000);
        })
        .filter((d): d is number => d != null);
      const avgAgeDays = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;

      return {
        openCount: open.length,
        openValue,
        avgAgeDays,
        lostCount: lost.length,
        lostValue,
      };
    },
  });

  return useMemo<{ data: BottlenecksData | null; isLoading: boolean; error: Error | null }>(() => {
    const isLoading =
      qualification.isLoading ||
      closedSummary.isLoading ||
      proposalsAggr.isLoading ||
      winLoss.isLoading ||
      (pipelineResolved && forecast.isLoading);

    const failedSources: string[] = [];
    if (qualification.error) failedSources.push('Qualidade de Qualificação');
    if (closedSummary.error) failedSources.push('Resultados/Auditoria');
    if (proposalsAggr.error) failedSources.push('Propostas');
    if (winLoss.error) failedSources.push('Win/Loss');
    if (forecast.error) failedSources.push('Forecast');

    if (!orgId) {
      return { data: null, isLoading: true, error: null };
    }

    const qual = qualification.data ?? null;
    const closed = closedSummary.data ?? null;
    const props = proposalsAggr.data ?? null;
    const wl = winLoss.data ?? null;
    const fc = forecast.kpis ?? null;

    // ── Seção 1: Vazamento do Funil
    const withoutProposal = qual?.summary.without_proposal_count ?? 0;
    const qualifiedCount = qual?.summary.qualified_count ?? 0;
    const withoutProposalPct =
      qualifiedCount > 0 ? (withoutProposal / qualifiedCount) * 100 : 0;

    const funnelLeaks: FunnelLeak[] = [
      {
        id: 'sqls_without_proposal',
        label: 'SQLs sem proposta',
        count: withoutProposal,
        value: null,
        helper:
          qualifiedCount > 0
            ? `${withoutProposalPct.toFixed(0)}% dos SQLs do período`
            : 'Sem SQLs no período',
        source: 'Qualidade de Qualificação',
        cta: { label: 'Abrir Qualidade', to: '/app/objetivos/desempenho' },
        available: !!qual,
      },
      {
        id: 'open_proposals',
        label: 'Propostas sem fechamento',
        count: props?.openCount ?? 0,
        value: props?.openValue ?? 0,
        helper:
          props?.avgAgeDays != null
            ? `Tempo médio aberto: ${props.avgAgeDays.toFixed(0)} dias`
            : 'Sem propostas abertas',
        source: 'Propostas',
        cta: { label: 'Abrir Pipeline', to: '/app/pipeline' },
        available: !!props,
      },
      {
        id: 'lost_proposals',
        label: 'Propostas perdidas',
        count: props?.lostCount ?? 0,
        value: props?.lostValue ?? 0,
        helper: 'no período',
        source: 'Propostas',
        cta: { label: 'Abrir Win/Loss', to: '/app/intelligence/winloss' },
        available: !!props,
      },
      {
        id: 'cancelled_sales',
        label: 'Vendas canceladas',
        count: closed?.cancelledCount ?? 0,
        value: closed?.cancelledTotal ?? 0,
        helper: 'no período',
        source: 'Resultados / Auditoria',
        cta: { label: 'Abrir Auditoria', to: '/app/objetivos/resultados' },
        available: !!closed,
      },
    ];

    // ── Seção 2: Onde os negócios morrem (lostStageBreakdown)
    const totalLostStages = (wl?.lostStageBreakdown ?? []).reduce(
      (s, r) => s + r.count,
      0,
    );
    const deathStages: DeathStage[] = (wl?.lostStageBreakdown ?? [])
      .filter((r) => r.count > 0)
      .map((r) => ({
        stageId: r.stageId,
        stageName: r.stageName,
        count: r.count,
        pct: totalLostStages > 0 ? (r.count / totalLostStages) * 100 : 0,
        lostValue: r.lostValue,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Seção 3: Motivos de perda (Top 10)
    const totalLossCount = (wl?.lossReasons ?? []).reduce((s, r) => s + r.count, 0);
    const avgLostTicket =
      wl && wl.lostCount > 0 ? wl.lostValue / wl.lostCount : 0;
    const lossReasons: LossReasonItem[] = (wl?.lossReasons ?? [])
      .slice(0, 10)
      .map((r) => ({
        reason: r.reason,
        count: r.count,
        pct: totalLossCount > 0 ? (r.count / totalLossCount) * 100 : 0,
        lostValue: r.count * avgLostTicket,
      }));

    // ── Seção 4: Velocidade
    const qualRows = qual?.rows ?? [];
    const sqlToProposalHours = qualRows
      .map((r) => r.avg_hours_qualification_to_proposal)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avgSqlToProposalHours =
      sqlToProposalHours.length > 0
        ? sqlToProposalHours.reduce((a, b) => a + b, 0) / sqlToProposalHours.length
        : null;

    const speedMetrics: SpeedMetric[] = [
      {
        id: 'sql_to_proposal',
        label: 'SQL → Proposta',
        days: avgSqlToProposalHours != null ? avgSqlToProposalHours / 24 : null,
        hours: avgSqlToProposalHours,
        available: avgSqlToProposalHours != null,
        helper: 'Tempo médio de qualificação até proposta',
      },
      {
        id: 'proposal_to_won',
        label: 'Proposta → Venda',
        days: wl?.avgCycleWon ?? null,
        hours: null,
        available: (wl?.avgCycleWon ?? null) != null,
        helper: 'Ciclo médio de vendas ganhas',
      },
      {
        id: 'won_to_delivery',
        label: 'Venda → Entrega',
        days: null,
        hours: null,
        available: false,
        helper: 'Disponível na próxima sprint',
      },
      {
        id: 'won_to_settlement',
        label: 'Venda → Liquidação',
        days: null,
        hours: null,
        available: false,
        helper: 'Disponível na próxima sprint',
      },
    ];

    // ── Seção 5: Receita em risco
    const totalPipeline = fc?.totalPipeline ?? null;
    const openProposalsValue = props?.openValue ?? 0;
    const negotiationValue =
      totalPipeline != null ? Math.max(0, totalPipeline - openProposalsValue) : null;

    const revenueRisk: RevenueRiskItem[] = [
      {
        id: 'open_proposals',
        label: 'Receita parada em propostas',
        value: openProposalsValue,
        helper:
          props?.openCount != null
            ? `${props.openCount} propostas abertas`
            : undefined,
        available: !!props,
      },
      {
        id: 'pipeline_open',
        label: 'Receita em negociação',
        value: negotiationValue ?? 0,
        helper: 'Pipeline aberto fora de proposta',
        available: negotiationValue != null,
      },
      {
        id: 'forecast_dependent',
        label: 'Receita dependente de forecast',
        value: totalPipeline ?? 0,
        helper: 'Pipeline total considerado pelo forecast',
        available: totalPipeline != null,
      },
    ];

    // ── Seção 6: Diagnóstico executivo
    const topDeath = deathStages[0];
    const topReason = lossReasons[0];

    const summaryParts: string[] = [];
    if (topDeath) {
      summaryParts.push(
        `A principal perda atual ocorre na etapa "${topDeath.stageName}" (${topDeath.pct.toFixed(0)}% das perdas).`,
      );
    }
    if (topReason && totalLossCount > 0) {
      summaryParts.push(
        `O motivo mais recorrente é "${topReason.reason}" com ${topReason.count} ocorrência(s) (${topReason.pct.toFixed(0)}%).`,
      );
    }
    if (props && props.openValue > 0) {
      summaryParts.push(
        `Existem ${fmtBRL(props.openValue)} em propostas abertas` +
          (props.avgAgeDays != null
            ? ` (idade média ${props.avgAgeDays.toFixed(0)} dias).`
            : '.'),
      );
    }
    if (closed && closed.cancelledTotal > 0) {
      summaryParts.push(
        `${fmtBRL(closed.cancelledTotal)} foram cancelados no período (${closed.cancelledCount} venda(s)).`,
      );
    }
    if (withoutProposal > 0 && qualifiedCount > 0) {
      summaryParts.push(
        `${withoutProposalPct.toFixed(0)}% dos SQLs ainda não viraram proposta.`,
      );
    }

    const executiveSummary =
      summaryParts.length > 0
        ? summaryParts.join(' ')
        : 'Sem gargalos relevantes detectados no período com as fontes disponíveis.';

    const data: BottlenecksData = {
      funnelLeaks,
      deathStages,
      lossReasons,
      speedMetrics,
      revenueRisk,
      executiveSummary,
      scope: {
        label: 'Pipeline de Vendas',
        pipelineId: salesPipelineId ?? null,
        pipelineName: salesPipelineName ?? null,
        resolved: pipelineResolved,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        period: { start, end },
        sources: [
          'Qualidade de Qualificação',
          'Win/Loss',
          'Resultados/Auditoria',
          'Forecast',
          'Propostas',
        ],
        partial: failedSources.length > 0,
        failedSources,
      },
    };

    return { data, isLoading, error: null };
  }, [
    orgId,
    qualification.data,
    qualification.error,
    qualification.isLoading,
    closedSummary.data,
    closedSummary.error,
    closedSummary.isLoading,
    proposalsAggr.data,
    proposalsAggr.error,
    proposalsAggr.isLoading,
    winLoss.data,
    winLoss.error,
    winLoss.isLoading,
    pipelineResolved,
    salesPipelineId,
    salesPipelineName,
    forecast.kpis,
    forecast.error,
    forecast.isLoading,
    start,
    end,
    now,
  ]);
}
