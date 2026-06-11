/**
 * Sprint RCC V3.6 — Hook agregador da aba "Riscos".
 *
 * Consome SOMENTE fontes oficiais já existentes:
 *  - useForecastData (Forecast V2 — meta, commit, best case, totalPipeline, nrhsConfidence)
 *  - useForecastSalesPipeline (pipeline comercial oficial)
 *  - useClosedRevenueSummary (Resultados/Auditoria — receita realizada e cancelamentos)
 *  - useRevenueBySeller (concentração por vendedor)
 *  - useQualificationQualityV2 (qualidade de qualificação SDR)
 *  - useRevenuePipelineHealth (CRM Trust Score)
 *  - opportunities (Pipeline de Vendas) — concentração por deal aberto
 *
 * Nenhuma view, edge function ou regra financeira é criada/alterada.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useForecastSalesPipeline } from '@/hooks/forecast/useForecastSalesPipeline';
import { useForecastData } from '@/hooks/useForecastData';
import {
  useClosedRevenueSummary,
  useRevenueBySeller,
} from '@/hooks/revenue/useRevenueSsot';
import { useQualificationQualityV2 } from '@/hooks/reports/useQualificationQualityV2';
import { useRevenuePipelineHealth } from './useRevenuePipelineHealth';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskBlock {
  id:
    | 'goal'
    | 'pipeline_coverage'
    | 'revenue_concentration'
    | 'seller_dependency'
    | 'forecast_quality'
    | 'cancellations'
    | 'qualification_quality'
    | 'crm_trust_score';
  title: string;
  question: string;
  level: RiskLevel;
  status: string;
  diagnosis: string;
  metrics: { label: string; value: string; tone?: 'neutral' | 'good' | 'bad' }[];
  impactValue: number;
  impactHelper?: string;
  cta: { label: string; to: string };
  available: boolean;
}

export interface RecommendedRiskAction {
  id: string;
  title: string;
  reason: string;
  priority: 'alta' | 'média' | 'baixa';
  impactValue: number;
  to: string;
  ctaLabel: string;
}

export interface RisksData {
  blocks: RiskBlock[];
  ranking: RiskBlock[];
  actions: RecommendedRiskAction[];
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
function fmtPct(v: number, digits = 0) {
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

const LEVEL_RANK: Record<RiskLevel, number> = { high: 3, medium: 2, low: 1 };

export function useRevenueRisks() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const now = useMemo(() => new Date(), []);
  const periodStart = useMemo(() => startOfMonth(now), [now]);
  const periodEnd = now;
  const start = periodStart.toISOString();
  const end = periodEnd.toISOString();

  const { salesPipelineId, salesPipelineName, salesPipelineStatus } =
    useForecastSalesPipeline({ organizationId: orgId });
  const pipelineResolved =
    salesPipelineStatus === 'resolved' && !!salesPipelineId;

  const forecast = useForecastData({
    periodType: 'monthly',
    periodStart,
    periodEnd,
    pipelineId: pipelineResolved ? salesPipelineId ?? undefined : undefined,
    enabled: pipelineResolved,
  });

  const closedSummary = useClosedRevenueSummary({
    surface: 'revenue-command:risks',
    organizationId: orgId ?? undefined,
    start,
    end,
  });

  const bySeller = useRevenueBySeller({
    surface: 'revenue-command:risks',
    organizationId: orgId ?? undefined,
    start,
    end,
  });

  const qualification = useQualificationQualityV2({
    proposalStatus: 'any',
    includeRemovedUsers: false,
  });

  const pipelineHealth = useRevenuePipelineHealth();

  // Open opps for revenue concentration (top1/3/5).
  const openOppsQ = useQuery({
    queryKey: ['revenue-command:risks:open-opps', orgId, salesPipelineId],
    enabled: !!orgId && pipelineResolved,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await supabase
        .from('opportunities')
        .select('id,title,valor_previsto,owner_user_id')
        .eq('organization_id', orgId!)
        .eq('pipeline_id', salesPipelineId!)
        .is('deleted_at', null)
        .not('status', 'in', '(won,lost,cancelled,canceled)');
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{
        id: string;
        title: string | null;
        valor_previsto: number | null;
        owner_user_id: string | null;
      }>;
    },
  });

  return useMemo<{ data: RisksData | null; isLoading: boolean; error: Error | null }>(() => {
    const isLoading =
      (pipelineResolved && forecast.isLoading) ||
      closedSummary.isLoading ||
      bySeller.isLoading ||
      qualification.isLoading ||
      pipelineHealth.isLoading ||
      openOppsQ.isLoading;

    const failedSources: string[] = [];
    if (forecast.error) failedSources.push('Forecast');
    if (closedSummary.error) failedSources.push('Resultados/Auditoria');
    if (bySeller.error) failedSources.push('Receita por Vendedor');
    if (qualification.error) failedSources.push('Qualidade de Qualificação');
    if (pipelineHealth.error) failedSources.push('CRM Trust Score');
    if (openOppsQ.error) failedSources.push('Pipeline de Vendas');

    if (!orgId) return { data: null, isLoading: true, error: null };

    const fc = forecast.kpis ?? null;
    const closed = closedSummary.data ?? null;
    const sellers = bySeller.data ?? [];
    const qual = qualification.data ?? null;
    const ph = pipelineHealth.data ?? null;
    const openOpps = openOppsQ.data ?? [];

    // ── BLOCO 1 — META EM RISCO ────────────────────────────────────────
    const goal = fc?.goal ?? 0;
    const realized = fc?.closedRevenue ?? 0;
    const commit = fc?.commitForecast ?? 0;
    const bestCase = fc?.bestCaseForecast ?? 0;
    const goalGap = Math.max(0, goal - realized);
    let goalLevel: RiskLevel = 'low';
    let goalStatus = 'Meta projetada com folga.';
    if (goal > 0) {
      if (commit >= goal) {
        goalLevel = 'low';
        goalStatus = `Meta projetada em ${fmtPct((commit / goal) * 100)} (commit).`;
      } else if (bestCase >= goal) {
        goalLevel = 'medium';
        goalStatus = `Meta só com Best Case (${fmtPct((bestCase / goal) * 100)}).`;
      } else {
        goalLevel = 'high';
        goalStatus = `Best Case projeta apenas ${fmtPct((bestCase / goal) * 100)} da meta.`;
      }
    }
    const goalDiagnosis =
      goal <= 0
        ? 'Sem meta configurada para o período.'
        : realized >= goal
          ? `Meta atingida (${fmtPct((realized / goal) * 100)}).`
          : `Faltam ${fmtBRL(goalGap)} para atingir a meta.`;
    const goalImpact = goal > 0 ? Math.max(0, goal - bestCase) : 0;

    const goalBlock: RiskBlock = {
      id: 'goal',
      title: 'Meta em risco',
      question: 'Qual a chance de não bater a meta?',
      level: goalLevel,
      status: goalStatus,
      diagnosis: goalDiagnosis,
      impactValue: goalImpact,
      impactHelper: goalImpact > 0 ? 'Lacuna até o best case' : 'Sem lacuna projetada',
      cta: { label: 'Abrir Forecast', to: '/app/forecast' },
      available: !!fc && goal > 0,
      metrics: [
        { label: 'Meta', value: fmtBRL(goal) },
        { label: 'Realizado', value: fmtBRL(realized) },
        { label: 'Commit', value: fmtBRL(commit) },
        { label: 'Best Case', value: fmtBRL(bestCase) },
      ],
    };

    // ── BLOCO 2 — PIPELINE INSUFICIENTE ────────────────────────────────
    const totalPipeline = fc?.totalPipeline ?? 0;
    const coverage = goal > 0 ? totalPipeline / goal : 0;
    let covLevel: RiskLevel = 'low';
    let covStatus = `Cobertura ${coverage.toFixed(1)}x — saudável.`;
    if (goal > 0) {
      if (coverage < 2) {
        covLevel = 'high';
        covStatus = `Cobertura ${coverage.toFixed(1)}x — abaixo do mínimo (<2x).`;
      } else if (coverage < 3) {
        covLevel = 'medium';
        covStatus = `Cobertura ${coverage.toFixed(1)}x — limítrofe (2x–3x).`;
      }
    }
    const covMissing = goal > 0 ? Math.max(0, goal * 2 - totalPipeline) : 0;
    const covImpact = covLevel === 'high' ? covMissing : covLevel === 'medium' ? covMissing : 0;
    const coverageBlock: RiskBlock = {
      id: 'pipeline_coverage',
      title: 'Pipeline insuficiente',
      question: 'Existe pipeline suficiente para sustentar a meta?',
      level: covLevel,
      status: covStatus,
      diagnosis:
        goal > 0
          ? coverage < 2
            ? `Faltam ${fmtBRL(covMissing)} em pipeline para atingir cobertura mínima de 2x.`
            : `Pipeline atual de ${fmtBRL(totalPipeline)} cobre ${coverage.toFixed(1)}x a meta.`
          : 'Sem meta configurada para calcular cobertura.',
      impactValue: covImpact,
      impactHelper: covImpact > 0 ? 'Pipeline faltante para cobertura 2x' : 'Cobertura adequada',
      cta: { label: 'Abrir Pipeline', to: '/app/pipeline' },
      available: !!fc && goal > 0,
      metrics: [
        { label: 'Pipeline', value: fmtBRL(totalPipeline) },
        { label: 'Cobertura', value: `${coverage.toFixed(1)}x` },
        { label: 'Receita faltante', value: fmtBRL(goalGap) },
      ],
    };

    // ── BLOCO 3 — RECEITA CONCENTRADA ──────────────────────────────────
    const sortedOpen = [...openOpps]
      .map((o) => ({ ...o, v: Number(o.valor_previsto) || 0 }))
      .filter((o) => o.v > 0)
      .sort((a, b) => b.v - a.v);
    const sumOpen = sortedOpen.reduce((s, o) => s + o.v, 0);
    const top1 = sortedOpen.slice(0, 1).reduce((s, o) => s + o.v, 0);
    const top3 = sortedOpen.slice(0, 3).reduce((s, o) => s + o.v, 0);
    const top5 = sortedOpen.slice(0, 5).reduce((s, o) => s + o.v, 0);
    const pct = (n: number) => (sumOpen > 0 ? (n / sumOpen) * 100 : 0);
    const top1Pct = pct(top1);
    const top3Pct = pct(top3);
    const top5Pct = pct(top5);

    let concLevel: RiskLevel = 'low';
    if (sumOpen > 0) {
      if (top1Pct >= 40 || top3Pct >= 70) concLevel = 'high';
      else if (top1Pct >= 25 || top3Pct >= 55) concLevel = 'medium';
    }
    const concentrationBlock: RiskBlock = {
      id: 'revenue_concentration',
      title: 'Receita concentrada',
      question: 'A operação depende de poucas oportunidades?',
      level: concLevel,
      status:
        sumOpen > 0
          ? `Top 1 = ${fmtPct(top1Pct)} · Top 3 = ${fmtPct(top3Pct)} · Top 5 = ${fmtPct(top5Pct)}`
          : 'Sem oportunidades abertas para avaliar concentração.',
      diagnosis:
        sumOpen > 0
          ? `${fmtPct(top3Pct)} do pipeline depende de apenas ${Math.min(3, sortedOpen.length)} oportunidades.`
          : 'Sem dados de concentração.',
      impactValue: top3,
      impactHelper: 'Valor concentrado no Top 3',
      cta: { label: 'Abrir Pipeline', to: '/app/pipeline' },
      available: sortedOpen.length > 0,
      metrics: [
        { label: 'Top 1', value: fmtPct(top1Pct) },
        { label: 'Top 3', value: fmtPct(top3Pct) },
        { label: 'Top 5', value: fmtPct(top5Pct) },
        { label: 'Valor Top 3', value: fmtBRL(top3) },
      ],
    };

    // ── BLOCO 4 — DEPENDÊNCIA DE VENDEDOR ──────────────────────────────
    const sortedSellers = [...sellers]
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
    const totalSellersRev = sortedSellers.reduce((s, x) => s + x.total, 0);
    const topSeller = sortedSellers[0];
    const topSellerPct =
      topSeller && totalSellersRev > 0 ? (topSeller.total / totalSellersRev) * 100 : 0;
    let depLevel: RiskLevel = 'low';
    if (topSellerPct >= 60) depLevel = 'high';
    else if (topSellerPct >= 40) depLevel = 'medium';
    const secondPct =
      sortedSellers[1] && totalSellersRev > 0
        ? (sortedSellers[1].total / totalSellersRev) * 100
        : 0;
    const thirdPct =
      sortedSellers[2] && totalSellersRev > 0
        ? (sortedSellers[2].total / totalSellersRev) * 100
        : 0;
    const dependencyBlock: RiskBlock = {
      id: 'seller_dependency',
      title: 'Dependência de vendedor',
      question: 'Se um vendedor parar, quanto da receita some?',
      level: depLevel,
      status: topSeller
        ? `${topSeller.label} responde por ${fmtPct(topSellerPct)} da receita do período.`
        : 'Sem receita atribuída no período.',
      diagnosis: topSeller
        ? `${fmtPct(topSellerPct)} da receita está concentrada em ${topSeller.label}.`
        : 'Sem amostra de vendedores no período.',
      impactValue: topSeller?.total ?? 0,
      impactHelper: 'Receita dependente do Top 1',
      cta: { label: 'Abrir Desempenho', to: '/app/objetivos/desempenho' },
      available: !!topSeller,
      metrics: topSeller
        ? [
            { label: topSeller.label, value: fmtPct(topSellerPct) },
            ...(sortedSellers[1]
              ? [{ label: sortedSellers[1].label, value: fmtPct(secondPct) }]
              : []),
            ...(sortedSellers[2]
              ? [{ label: sortedSellers[2].label, value: fmtPct(thirdPct) }]
              : []),
          ]
        : [],
    };

    // ── BLOCO 5 — FORECAST FRACO ───────────────────────────────────────
    const nrhsAvg = fc?.nrhsAverage ?? 0;
    const confidenceMap: Record<string, { lvl: RiskLevel; label: string }> = {
      high: { lvl: 'low', label: 'Alta confiança' },
      moderate: { lvl: 'medium', label: 'Confiança moderada' },
      low: { lvl: 'high', label: 'Baixa confiança' },
      very_low: { lvl: 'high', label: 'Confiança muito baixa' },
    };
    const confInfo = confidenceMap[fc?.nrhsConfidence ?? 'moderate'] ?? confidenceMap.moderate;
    const forecastBlock: RiskBlock = {
      id: 'forecast_quality',
      title: 'Forecast fraco',
      question: 'O forecast é confiável?',
      level: confInfo.lvl,
      status: `${confInfo.label} · NRHS médio ${nrhsAvg.toFixed(0)}/100`,
      diagnosis:
        confInfo.lvl === 'low'
          ? 'Forecast consistente com dados qualificados pelo NRHS.'
          : confInfo.lvl === 'medium'
            ? 'Parte do pipeline está com qualificação parcial — atenção a deals sem score.'
            : 'Forecast instável — alto volume de oportunidades sem qualificação NRHS.',
      impactValue: fc?.excludedByNrhsValue ?? 0,
      impactHelper: `${fc?.excludedByNrhsCount ?? 0} oportunidades excluídas do forecast por NRHS`,
      cta: { label: 'Abrir Forecast', to: '/app/forecast' },
      available: !!fc,
      metrics: [
        { label: 'NRHS médio', value: `${nrhsAvg.toFixed(0)}/100` },
        { label: 'Confiança', value: confInfo.label },
        { label: 'Excluídas', value: `${fc?.excludedByNrhsCount ?? 0}` },
      ],
    };

    // ── BLOCO 6 — CANCELAMENTOS ────────────────────────────────────────
    const cancCount = closed?.cancelledCount ?? 0;
    const cancTotal = closed?.cancelledTotal ?? 0;
    let cancLevel: RiskLevel = 'low';
    if (realized > 0) {
      const ratio = cancTotal / Math.max(1, realized + cancTotal);
      if (ratio >= 0.15) cancLevel = 'high';
      else if (ratio >= 0.05) cancLevel = 'medium';
    } else if (cancTotal > 0) {
      cancLevel = 'medium';
    }
    const cancellationsBlock: RiskBlock = {
      id: 'cancellations',
      title: 'Cancelamentos',
      question: 'Quanto dinheiro voltou para trás?',
      level: cancLevel,
      status:
        cancCount > 0
          ? `${cancCount} cancelamento(s) · ${fmtBRL(cancTotal)} no período`
          : 'Sem cancelamentos no período.',
      diagnosis:
        cancLevel === 'high'
          ? 'Impacto alto — cancelamentos representam parte relevante da receita.'
          : cancLevel === 'medium'
            ? 'Impacto moderado de cancelamentos no período.'
            : 'Impacto baixo de cancelamentos.',
      impactValue: cancTotal,
      impactHelper: 'Receita cancelada no período',
      cta: { label: 'Abrir Auditoria', to: '/app/objetivos/resultados' },
      available: !!closed,
      metrics: [
        { label: 'Quantidade', value: `${cancCount}` },
        { label: 'Receita cancelada', value: fmtBRL(cancTotal) },
      ],
    };

    // ── BLOCO 7 — QUALIDADE DE QUALIFICAÇÃO ────────────────────────────
    const sqls = qual?.summary.qualified_count ?? 0;
    const without = qual?.summary.without_proposal_count ?? 0;
    const sqlToProp = qual?.summary.sql_to_proposal_rate ?? 0;
    const sqlToWon = qual?.summary.sql_to_won_rate ?? 0;
    let qLevel: RiskLevel = 'low';
    if (sqls > 0) {
      const w = without / sqls;
      if (w >= 0.5 || sqlToProp < 30) qLevel = 'high';
      else if (w >= 0.3 || sqlToProp < 50) qLevel = 'medium';
    }
    const qualificationBlock: RiskBlock = {
      id: 'qualification_quality',
      title: 'Qualidade de qualificação',
      question: 'Os SDRs estão alimentando risco?',
      level: qLevel,
      status:
        sqls > 0
          ? `${sqls} SQLs · SQL→Proposta ${fmtPct(sqlToProp)} · SQL→Venda ${fmtPct(sqlToWon)}`
          : 'Sem SQLs qualificados no período.',
      diagnosis:
        without > 0
          ? `${without} SQL(s) qualificados sem gerar proposta.`
          : sqls > 0
            ? 'Todos os SQLs do período geraram proposta.'
            : 'Sem amostra para diagnóstico.',
      impactValue: 0,
      impactHelper: `${without} SQLs travados sem proposta`,
      cta: { label: 'Abrir Qualidade', to: '/app/objetivos/desempenho' },
      available: !!qual && sqls > 0,
      metrics: [
        { label: 'SQLs', value: `${sqls}` },
        { label: 'SQL→Proposta', value: fmtPct(sqlToProp) },
        { label: 'SQL→Venda', value: fmtPct(sqlToWon) },
        { label: 'Sem proposta', value: `${without}` },
      ],
    };

    // ── BLOCO 8 — CRM TRUST SCORE ──────────────────────────────────────
    const trust = ph?.trustScore ?? null;
    let trustLevel: RiskLevel = 'low';
    if (trust != null) {
      if (trust < 70) trustLevel = 'high';
      else if (trust < 85) trustLevel = 'medium';
    } else {
      trustLevel = 'medium';
    }
    const trustBlock: RiskBlock = {
      id: 'crm_trust_score',
      title: 'CRM Trust Score',
      question: 'Posso confiar nesses dados?',
      level: trustLevel,
      status: trust != null ? `${trust.toFixed(0)}/100 · ${ph?.trustLabel}` : 'Sem dados ativos.',
      diagnosis:
        trust == null
          ? 'Sem dados de confiabilidade do CRM.'
          : trust >= 85
            ? 'Boa qualidade de dados — decisões podem ser tomadas com segurança.'
            : trust >= 70
              ? 'Atenção — parte das oportunidades não está higienizada.'
              : 'Dados comprometidos — higienize o pipeline antes de decidir.',
      impactValue: ph?.moneyAtRisk
        ? (ph.moneyAtRisk.noActivityValue ?? 0) +
          (ph.moneyAtRisk.overdueValue ?? 0) +
          (ph.moneyAtRisk.staleValue ?? 0)
        : 0,
      impactHelper: 'Valor em oportunidades sem higiene',
      cta: { label: 'Abrir Pipeline', to: '/app/pipeline' },
      available: trust != null,
      metrics: [
        { label: 'Trust Score', value: trust != null ? `${trust.toFixed(0)}/100` : '—' },
        { label: 'Status', value: ph?.trustLabel ?? '—' },
      ],
    };

    const blocks: RiskBlock[] = [
      goalBlock,
      coverageBlock,
      concentrationBlock,
      dependencyBlock,
      forecastBlock,
      cancellationsBlock,
      qualificationBlock,
      trustBlock,
    ];

    // Ranking por nível + impacto
    const ranking = [...blocks]
      .filter((b) => b.level !== 'low')
      .sort((a, b) => {
        const lvl = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
        if (lvl !== 0) return lvl;
        return b.impactValue - a.impactValue;
      });

    // Ações recomendadas — derivadas dos blocos
    const actions: RecommendedRiskAction[] = [];
    if (covLevel !== 'low' && goal > 0) {
      actions.push({
        id: 'increase_coverage',
        title: 'Aumentar cobertura do pipeline',
        reason: `Cobertura atual ${coverage.toFixed(1)}x — faltam ${fmtBRL(covMissing)} para 2x.`,
        priority: covLevel === 'high' ? 'alta' : 'média',
        impactValue: covMissing,
        to: '/app/pipeline',
        ctaLabel: 'Abrir Pipeline',
      });
    }
    if (concLevel !== 'low' && topSeller) {
      actions.push({
        id: 'reduce_concentration',
        title: 'Reduzir dependência do Top 1',
        reason: `Top 1 deal concentra ${fmtPct(top1Pct)} do pipeline aberto.`,
        priority: concLevel === 'high' ? 'alta' : 'média',
        impactValue: top1,
        to: '/app/pipeline',
        ctaLabel: 'Abrir Pipeline',
      });
    }
    if (depLevel !== 'low' && topSeller) {
      actions.push({
        id: 'diversify_sellers',
        title: `Diversificar receita além de ${topSeller.label}`,
        reason: `${fmtPct(topSellerPct)} da receita está em um único vendedor.`,
        priority: depLevel === 'high' ? 'alta' : 'média',
        impactValue: topSeller.total,
        to: '/app/objetivos/desempenho',
        ctaLabel: 'Abrir Desempenho',
      });
    }
    if (forecastBlock.level !== 'low' && (fc?.excludedByNrhsCount ?? 0) > 0) {
      actions.push({
        id: 'fix_forecast',
        title: 'Corrigir oportunidades sem qualificação NRHS',
        reason: `${fc!.excludedByNrhsCount} deals excluídos do forecast por falta de qualificação.`,
        priority: forecastBlock.level === 'high' ? 'alta' : 'média',
        impactValue: fc!.excludedByNrhsValue ?? 0,
        to: '/app/forecast',
        ctaLabel: 'Abrir Forecast',
      });
    }
    if (qLevel !== 'low' && without > 0) {
      actions.push({
        id: 'unblock_sqls',
        title: `Revisar ${without} SQLs sem proposta`,
        reason: `Conversão SQL→Proposta em ${fmtPct(sqlToProp)}.`,
        priority: qLevel === 'high' ? 'alta' : 'média',
        impactValue: 0,
        to: '/app/objetivos/desempenho',
        ctaLabel: 'Abrir Qualidade',
      });
    }
    if (cancLevel !== 'low' && cancTotal > 0) {
      actions.push({
        id: 'review_cancellations',
        title: 'Investigar cancelamentos recentes',
        reason: `${cancCount} cancelamento(s) totalizando ${fmtBRL(cancTotal)}.`,
        priority: cancLevel === 'high' ? 'alta' : 'média',
        impactValue: cancTotal,
        to: '/app/objetivos/resultados',
        ctaLabel: 'Abrir Auditoria',
      });
    }
    if (trustLevel !== 'low' && (ph?.issues?.length ?? 0) > 0) {
      const topIssue = ph!.issues[0];
      actions.push({
        id: 'fix_crm_hygiene',
        title: `Higienizar ${topIssue.count} oportunidades (${topIssue.label})`,
        reason: `CRM Trust Score em ${trust?.toFixed(0)}/100.`,
        priority: trustLevel === 'high' ? 'alta' : 'média',
        impactValue: topIssue.value,
        to: '/app/pipeline',
        ctaLabel: 'Abrir Pipeline',
      });
    }
    if (goalLevel === 'high') {
      actions.push({
        id: 'protect_goal',
        title: 'Proteger meta do período',
        reason: `Faltam ${fmtBRL(goalGap)} e best case projeta ${fmtPct(goal > 0 ? (bestCase / goal) * 100 : 0)} da meta.`,
        priority: 'alta',
        impactValue: goalGap,
        to: '/app/forecast',
        ctaLabel: 'Abrir Forecast',
      });
    }

    actions.sort((a, b) => {
      const p = { alta: 3, média: 2, baixa: 1 } as const;
      const pp = p[b.priority] - p[a.priority];
      if (pp !== 0) return pp;
      return b.impactValue - a.impactValue;
    });

    const data: RisksData = {
      blocks,
      ranking,
      actions,
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
          'Forecast V2',
          'Win/Loss Hub',
          'Pipeline de Vendas',
          'Receita por Vendedor',
          'Qualidade de Qualificação',
          'Resultados / Auditoria',
          'CRM Trust Score',
        ],
        partial: failedSources.length > 0,
        failedSources,
      },
    };

    return { data, isLoading, error: null };
  }, [
    orgId,
    pipelineResolved,
    salesPipelineId,
    salesPipelineName,
    forecast.kpis,
    forecast.isLoading,
    forecast.error,
    closedSummary.data,
    closedSummary.isLoading,
    closedSummary.error,
    bySeller.data,
    bySeller.isLoading,
    bySeller.error,
    qualification.data,
    qualification.isLoading,
    qualification.error,
    pipelineHealth.data,
    pipelineHealth.isLoading,
    pipelineHealth.error,
    openOppsQ.data,
    openOppsQ.isLoading,
    openOppsQ.error,
    start,
    end,
  ]);
}
