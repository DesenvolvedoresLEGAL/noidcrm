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
    queryKey: ['revenue-command:bottlenecks:proposals:v3.2c', orgId, salesPipelineId, start, end],
    enabled: !!orgId && pipelineResolved,
    staleTime: 60_000,
    queryFn: async () => {
      const openQ = await supabase
        .from('proposals')
        .select('id, total_amount, sent_at, created_at, opportunities!inner(pipeline_id)')
        .eq('organization_id', orgId!)
        .eq('status', 'sent')
        .eq('opportunities.pipeline_id', salesPipelineId!);
      if (openQ.error) throw openQ.error;

      const lostQ = await supabase
        .from('proposals')
        .select('id, total_amount, opportunities!inner(pipeline_id)')
        .eq('organization_id', orgId!)
        .eq('status', 'rejected')
        .eq('opportunities.pipeline_id', salesPipelineId!)
        .gte('created_at', start)
        .lte('created_at', end);
      if (lostQ.error) throw lostQ.error;

      // HOTFIX V3.2C: Oportunidades comerciais ABERTAS no Pipeline de Vendas
      const openOppsQ = await supabase
        .from('opportunities')
        .select('id, valor_previsto, created_at')
        .eq('organization_id', orgId!)
        .eq('pipeline_id', salesPipelineId!)
        .eq('status', 'open')
        .is('deleted_at', null);
      if (openOppsQ.error) throw openOppsQ.error;

      const open = openQ.data ?? [];
      const lost = lostQ.data ?? [];
      const openOpps = openOppsQ.data ?? [];

      const openValue = open.reduce((s, p: any) => s + (Number(p.total_amount) || 0), 0);
      const lostValue = lost.reduce((s, p: any) => s + (Number(p.total_amount) || 0), 0);
      const openOppsValue = openOpps.reduce(
        (s, o: any) => s + (Number(o.valor_previsto) || 0),
        0,
      );

      const nowMs = now.getTime();
      const ages = open
        .map((p: any) => {
          const ref = p.sent_at || p.created_at;
          if (!ref) return null;
          return Math.max(0, (nowMs - new Date(ref).getTime()) / 86_400_000);
        })
        .filter((d): d is number => d != null);
      const avgAgeDays = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;

      const oppAges = openOpps
        .map((o: any) => {
          if (!o.created_at) return null;
          return Math.max(0, (nowMs - new Date(o.created_at).getTime()) / 86_400_000);
        })
        .filter((d): d is number => d != null);
      const avgOppAgeDays = oppAges.length
        ? oppAges.reduce((a, b) => a + b, 0) / oppAges.length
        : null;

      return {
        openCount: open.length,
        openValue,
        avgAgeDays,
        lostCount: lost.length,
        lostValue,
        openOppsCount: openOpps.length,
        openOppsValue,
        avgOppAgeDays,
      };
    },
  });

  // 7) Velocidade SQL → Proposta (HOTFIX V3.2B)
  //    A qualificação (SQL) costuma nascer no pipeline de Pré-vendas.
  //    A proposta/oportunidade comercial vive no Pipeline de Vendas.
  //    Por isso o filtro `pipeline_id = salesPipelineId` é aplicado ao
  //    DESTINO comercial — nunca à origem da qualificação. Caso contrário
  //    o handoff Pré-vendas → Vendas é apagado e a amostra fica vazia.
  //
  //    Cruzamento:
  //      - Origem: qualquer oportunidade da org com qualified_at NOT NULL
  //                (pipelines de qualificação OU de vendas — duplicatas
  //                podem ter herdado qualified_at).
  //      - Destino comercial: oportunidade no Pipeline de Vendas oficial
  //                tal que sales.id = qualified.id (mesmo registro, caso
  //                qualified_at já tenha sido copiado) OU
  //                sales.source_opportunity_id = qualified.id (duplicação
  //                Pré-vendas → Vendas).
  //      - Fim preferencial: MIN(proposals.created_at) na opp comercial
  //        Fallback: sales.created_at | MIN(proposals.sent_at)
  //
  //    Métrica de handoff/velocidade — não toca em regras financeiras.
  const velocityAggr = useQuery({
    queryKey: ['revenue-command:bottlenecks:velocity:v3.2b', orgId, salesPipelineId],
    enabled: !!orgId && pipelineResolved,
    staleTime: 60_000,
    queryFn: async () => {
      // (A) Qualificações da organização (qualquer pipeline)
      const qualQ = await supabase
        .from('opportunities')
        .select('id, qualified_at, pipeline_id, created_at')
        .eq('organization_id', orgId!)
        .is('deleted_at', null)
        .not('qualified_at', 'is', null)
        .limit(5000);
      if (qualQ.error) throw qualQ.error;
      const qualified = (qualQ.data ?? []) as any[];

      // (B) Oportunidades comerciais no Pipeline de Vendas
      const salesQ = await supabase
        .from('opportunities')
        .select('id, created_at, source_opportunity_id')
        .eq('organization_id', orgId!)
        .eq('pipeline_id', salesPipelineId!)
        .is('deleted_at', null)
        .limit(5000);
      if (salesQ.error) throw salesQ.error;
      const salesOpps = (salesQ.data ?? []) as any[];

      const salesIds = salesOpps.map((s) => s.id);
      // (C) Propostas dessas oportunidades de Vendas
      let proposals: any[] = [];
      if (salesIds.length) {
        // chunked IN para evitar URL gigante
        const chunk = 500;
        for (let i = 0; i < salesIds.length; i += chunk) {
          const slice = salesIds.slice(i, i + chunk);
          const pq = await supabase
            .from('proposals')
            .select('opportunity_id, created_at, sent_at, viewed_at')
            .in('opportunity_id', slice);
          if (pq.error) throw pq.error;
          proposals = proposals.concat(pq.data ?? []);
        }
      }

      const firstProposalByOpp = new Map<string, { created: number; sent: number; viewed: number }>();
      for (const p of proposals) {
        const oid = p.opportunity_id as string;
        const cur = firstProposalByOpp.get(oid) ?? { created: 0, sent: 0, viewed: 0 };
        const created = p.created_at ? new Date(p.created_at).getTime() : 0;
        const sent = p.sent_at ? new Date(p.sent_at).getTime() : 0;
        const viewed = p.viewed_at ? new Date(p.viewed_at).getTime() : 0;
        if (created && (!cur.created || created < cur.created)) cur.created = created;
        if (sent && (!cur.sent || sent < cur.sent)) cur.sent = sent;
        if (viewed && (!cur.viewed || viewed < cur.viewed)) cur.viewed = viewed;
        firstProposalByOpp.set(oid, cur);
      }

      // Indexa oportunidades de Vendas por id e por source_opportunity_id
      const salesById = new Map<string, any>();
      const salesBySourceId = new Map<string, any>();
      for (const s of salesOpps) {
        salesById.set(s.id, s);
        if (s.source_opportunity_id) salesBySourceId.set(s.source_opportunity_id, s);
      }

      const diffsHours = {
        toProposalCreated: [] as number[],
        toProposalSent: [] as number[],
        toCommercialOpp: [] as number[],
        toFirstView: [] as number[],
      };

      let withCommercialLink = 0;
      let withProposalCreated = 0;

      for (const q of qualified) {
        const qAt = q.qualified_at ? new Date(q.qualified_at).getTime() : 0;
        if (!qAt) continue;
        const commercial = salesById.get(q.id) ?? salesBySourceId.get(q.id) ?? null;
        if (!commercial) continue;
        withCommercialLink++;

        const oppAt = commercial.created_at ? new Date(commercial.created_at).getTime() : 0;
        const fp = firstProposalByOpp.get(commercial.id);
        if (fp?.created) withProposalCreated++;

        if (fp?.created && fp.created > qAt) {
          diffsHours.toProposalCreated.push((fp.created - qAt) / 3_600_000);
        }
        if (fp?.sent && fp.sent > qAt) {
          diffsHours.toProposalSent.push((fp.sent - qAt) / 3_600_000);
        }
        if (oppAt && oppAt > qAt) {
          diffsHours.toCommercialOpp.push((oppAt - qAt) / 3_600_000);
        }
        if (fp?.viewed && fp.viewed > qAt) {
          diffsHours.toFirstView.push((fp.viewed - qAt) / 3_600_000);
        }
      }

      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      const result = {
        qualifiedCount: qualified.length,
        salesOppsCount: salesOpps.length,
        proposalsCount: proposals.length,
        withCommercialLink,
        withProposalCreated,
        avgHoursToProposalCreated: avg(diffsHours.toProposalCreated),
        sampleToProposalCreated: diffsHours.toProposalCreated.length,
        avgHoursToProposalSent: avg(diffsHours.toProposalSent),
        sampleToProposalSent: diffsHours.toProposalSent.length,
        avgHoursToCommercialOpp: avg(diffsHours.toCommercialOpp),
        sampleToCommercialOpp: diffsHours.toCommercialOpp.length,
        avgHoursToFirstView: avg(diffsHours.toFirstView),
        sampleToFirstView: diffsHours.toFirstView.length,
      };

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[RCC V3.2B] SQL→Proposta debug', result);
      }
      return result;
    },
  });


  return useMemo<{ data: BottlenecksData | null; isLoading: boolean; error: Error | null }>(() => {
    const isLoading =
      qualification.isLoading ||
      closedSummary.isLoading ||
      proposalsAggr.isLoading ||
      velocityAggr.isLoading ||
      winLoss.isLoading ||
      (pipelineResolved && forecast.isLoading);

    const failedSources: string[] = [];
    if (qualification.error) failedSources.push('Qualidade de Qualificação');
    if (closedSummary.error) failedSources.push('Resultados/Auditoria');
    if (proposalsAggr.error) failedSources.push('Propostas');
    if (velocityAggr.error) failedSources.push('Velocidade SQL→Proposta');
    if (winLoss.error) failedSources.push('Win/Loss');
    if (forecast.error) failedSources.push('Forecast');

    if (!orgId) {
      return { data: null, isLoading: true, error: null };
    }

    // ── Seção 1: Vazamento do Funil
    // HOTFIX V3.2C — origens consolidadas:
    //   Card 1 (SQLs sem proposta): prefere velocityAggr (cruza Pré-vendas →
    //     Vendas igual ao SQL→Proposta); fallback Qualidade de Qualificação.
    //   Card 2 (Propostas sem fechamento): oportunidades abertas no Pipeline
    //     de Vendas (não só proposals.status='sent').
    //   Card 3 (Propostas perdidas): Win/Loss oficial — mesma base de
    //     "Onde os negócios morrem" e "Motivos de perda".
    //   Card 4 (Vendas canceladas): Auditoria (commercial_won_revenue_view).
    const vel = velocityAggr.data ?? null;
    const qual = qualification.data ?? null;
    const closed = closedSummary.data ?? null;
    const props = proposalsAggr.data ?? null;
    const wl = winLoss.data ?? null;
    const fc = forecast.kpis ?? null;

    // Card 1
    const velQualified = vel?.qualifiedCount ?? 0;
    const velWithoutProposal = vel
      ? Math.max(0, vel.qualifiedCount - vel.withProposalCreated)
      : 0;
    const qualQualified = qual?.summary.qualified_count ?? 0;
    const qualWithoutProposal = qual?.summary.without_proposal_count ?? 0;

    const useVelForSql = !!vel && velQualified > 0;
    const sqlBaseAvailable = useVelForSql || !!qual;
    const sqlQualifiedCount = useVelForSql ? velQualified : qualQualified;
    const sqlWithoutProposal = useVelForSql ? velWithoutProposal : qualWithoutProposal;
    const sqlWithoutProposalPct =
      sqlQualifiedCount > 0 ? (sqlWithoutProposal / sqlQualifiedCount) * 100 : 0;
    const sqlSource = useVelForSql
      ? 'SQL→Proposta (Pré-vendas → Vendas)'
      : 'Qualidade de Qualificação';
    const sqlHelper = !sqlBaseAvailable
      ? 'Dados parciais — fonte indisponível'
      : sqlQualifiedCount > 0
        ? `${sqlWithoutProposalPct.toFixed(0)}% dos ${sqlQualifiedCount} SQLs ainda sem proposta`
        : 'SQLs qualificados que ainda não viraram proposta';

    // Card 3 — perdidas via Win/Loss
    const wlLostCount = wl?.lostCount ?? 0;
    const wlLostValue = wl?.lostValue ?? 0;
    const topLossReason = (wl?.lossReasons ?? [])[0]?.reason ?? null;

    const funnelLeaks: FunnelLeak[] = [
      {
        id: 'sqls_without_proposal',
        label: 'SQLs sem proposta',
        count: sqlWithoutProposal,
        value: null,
        helper: sqlHelper,
        source: sqlSource,
        cta: { label: 'Abrir Qualidade', to: '/app/objetivos/desempenho' },
        available: sqlBaseAvailable,
      },
      {
        id: 'open_proposals',
        label: 'Propostas sem fechamento',
        count: props?.openOppsCount ?? 0,
        value: props?.openOppsValue ?? 0,
        helper:
          props && props.openOppsCount > 0
            ? `Oportunidades comerciais abertas${
                props.avgOppAgeDays != null
                  ? ` · idade média ${props.avgOppAgeDays.toFixed(0)} dias`
                  : ''
              }`
            : 'Sem oportunidades abertas no Pipeline de Vendas',
        source: 'Pipeline de Vendas',
        cta: { label: 'Abrir Pipeline', to: '/app/pipeline' },
        available: !!props,
      },
      {
        id: 'lost_proposals',
        label: 'Propostas perdidas',
        count: wlLostCount,
        value: wlLostValue,
        helper:
          wlLostCount > 0
            ? topLossReason
              ? `no período · principal motivo: ${topLossReason}`
              : 'no período'
            : 'sem perdas no período',
        source: 'Win/Loss',
        cta: { label: 'Abrir Win/Loss', to: '/app/intelligence/winloss' },
        available: !!wl,
      },
      {
        id: 'cancelled_sales',
        label: 'Vendas canceladas',
        count: closed?.cancelledCount ?? 0,
        value: closed?.cancelledTotal ?? 0,
        helper:
          (closed?.cancelledCount ?? 0) > 0
            ? 'no período'
            : 'sem cancelamentos no período',
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
    //  Cálculo direto (V3.2A): qualified_at → primeira proposta criada/enviada
    //  com fallback para criação da oportunidade comercial e visualização.
    // `vel` already declared above

    const viewSqlToProposalHours = (qual?.rows ?? [])
      .map((r) => r.avg_hours_qualification_to_proposal)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avgFromView =
      viewSqlToProposalHours.length > 0
        ? viewSqlToProposalHours.reduce((a, b) => a + b, 0) /
          viewSqlToProposalHours.length
        : null;

    // Preferência: proposta criada > oportunidade comercial > proposta enviada
    const MIN_SAMPLE = 3;
    let primaryHours: number | null = null;
    let primarySource = '';
    if (vel) {
      if (vel.sampleToProposalCreated >= MIN_SAMPLE && vel.avgHoursToProposalCreated != null) {
        primaryHours = vel.avgHoursToProposalCreated;
        primarySource = 'até a primeira proposta criada';
      } else if (vel.sampleToCommercialOpp >= MIN_SAMPLE && vel.avgHoursToCommercialOpp != null) {
        primaryHours = vel.avgHoursToCommercialOpp;
        primarySource = 'até a criação da oportunidade comercial';
      } else if (vel.sampleToProposalSent >= MIN_SAMPLE && vel.avgHoursToProposalSent != null) {
        primaryHours = vel.avgHoursToProposalSent;
        primarySource = 'até o envio da proposta';
      }
    }
    if (primaryHours == null && avgFromView != null) {
      primaryHours = avgFromView;
      primarySource = 'até a proposta (Qualidade de Qualificação)';
    }

    const insufficientHelper = vel
      ? `Sem dados suficientes (qualificados=${vel.qualifiedCount}, com vínculo comercial=${vel.withCommercialLink}, com proposta criada=${vel.withProposalCreated}, amostras=${vel.sampleToProposalCreated})`
      : 'Sem dados suficientes';

    const speedMetrics: SpeedMetric[] = [
      {
        id: 'sql_to_proposal',
        label: 'SQL → Proposta',
        days: primaryHours != null ? primaryHours / 24 : null,
        hours: primaryHours,
        available: primaryHours != null,
        helper:
          primaryHours != null
            ? `Tempo médio da qualificação ${primarySource}`
            : insufficientHelper,
      },
      ...(vel && vel.sampleToCommercialOpp >= MIN_SAMPLE && vel.avgHoursToCommercialOpp != null
        ? [
            {
              id: 'sql_to_commercial_opp',
              label: 'SQL → Oportunidade comercial',
              days: vel.avgHoursToCommercialOpp / 24,
              hours: vel.avgHoursToCommercialOpp,
              available: true,
              helper: `Qualificação → criação da oportunidade comercial (n=${vel.sampleToCommercialOpp})`,
            } as SpeedMetric,
          ]
        : []),
      ...(vel && vel.sampleToProposalSent >= MIN_SAMPLE && vel.avgHoursToProposalSent != null
        ? [
            {
              id: 'sql_to_proposal_sent',
              label: 'SQL → Proposta enviada',
              days: vel.avgHoursToProposalSent / 24,
              hours: vel.avgHoursToProposalSent,
              available: true,
              helper: `Qualificação → envio da proposta (n=${vel.sampleToProposalSent})`,
            } as SpeedMetric,
          ]
        : []),
      ...(vel && vel.sampleToFirstView >= MIN_SAMPLE && vel.avgHoursToFirstView != null
        ? [
            {
              id: 'sql_to_first_view',
              label: 'SQL → 1ª visualização',
              days: vel.avgHoursToFirstView / 24,
              hours: vel.avgHoursToFirstView,
              available: true,
              helper: `Qualificação → 1ª visualização do cliente (n=${vel.sampleToFirstView})`,
            } as SpeedMetric,
          ]
        : []),
      {
        id: 'proposal_to_won',
        label: 'Proposta → Venda',
        days: wl?.avgCycleWon ?? null,
        hours: null,
        available: (wl?.avgCycleWon ?? null) != null,
        helper: 'Ciclo médio de vendas ganhas',
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
    if (sqlWithoutProposal > 0 && sqlQualifiedCount > 0) {
      summaryParts.push(
        `${sqlWithoutProposalPct.toFixed(0)}% dos SQLs ainda não viraram proposta.`,
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
    velocityAggr.data,
    velocityAggr.error,
    velocityAggr.isLoading,
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
