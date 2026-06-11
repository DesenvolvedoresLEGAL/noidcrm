/**
 * Sprint RCC V3.8 — Hook agregador da aba "Health & Trust".
 *
 * Camada de governança somente leitura. Consome APENAS os agregadores oficiais
 * já existentes do Revenue Command Center e expõe um trust score executivo,
 * status das fontes, cobertura, problemas detectados, impacto financeiro,
 * consistência entre fontes e ações recomendadas.
 *
 * Nenhuma view, edge function, tabela ou regra financeira é criada/alterada.
 */
import { useMemo } from 'react';
import { useRevenuePipelineHealth } from './useRevenuePipelineHealth';
import { useRevenueRisks } from './useRevenueRisks';
import { useRevenueBottlenecks } from './useRevenueBottlenecks';
import { useRevenueTodayCommand } from './useRevenueTodayCommand';

export type SourceStatus = 'ok' | 'partial' | 'failed' | 'unavailable' | 'loading';
export type SourceHealth = 'healthy' | 'attention' | 'critical' | 'unknown';

export interface HealthSource {
  id: string;
  label: string;
  status: SourceStatus;
  health: SourceHealth;
  coveragePct: number | null;
  updatedAt: string | null;
  helper?: string;
}

export interface CoverageItem {
  id: string;
  label: string;
  coveredPct: number;
  missingCount: number;
  totalCount: number;
}

export interface IssueItem {
  id: string;
  label: string;
  count: number;
  impactValue: number;
  impactLabel: string;
  cta?: { label: string; to: string };
}

export interface FinancialImpactItem {
  id: string;
  label: string;
  value: number;
}

export interface ConsistencyCheck {
  id: string;
  label: string;
  left: { label: string; value: number | null };
  right: { label: string; value: number | null };
  diff: number | null;
  status: 'ok' | 'diverged' | 'unavailable';
}

export interface HistoryPoint {
  label: string;
  score: number | null;
}

export interface RecommendedHealthAction {
  id: string;
  title: string;
  reason: string;
  impactValue: number;
  ctaLabel: string;
  to: string;
}

export type TrustLabel =
  | 'Excelente'
  | 'Confiável'
  | 'Atenção'
  | 'Baixa confiança'
  | 'Crítico'
  | 'Indisponível';

export interface HealthTrustData {
  trustScore: number | null;
  trustLabel: TrustLabel;
  trustSummary: string;
  breakdown: {
    integrity: number;
    coverage: number;
    freshness: number;
    hygiene: number;
    consistency: number;
  };
  sources: HealthSource[];
  coverage: CoverageItem[];
  issues: IssueItem[];
  financialImpact: {
    items: FinancialImpactItem[];
    total: number;
  };
  consistency: ConsistencyCheck[];
  history: { points: HistoryPoint[]; trend: 'improving' | 'stable' | 'worsening' | 'insufficient' };
  actions: RecommendedHealthAction[];
  meta: {
    generatedAt: string;
    sourceCount: number;
    healthySources: number;
    warningSources: number;
    failedSources: number;
    confidence: TrustLabel;
  };
}

function classify(score: number | null): TrustLabel {
  if (score == null) return 'Indisponível';
  if (score >= 95) return 'Excelente';
  if (score >= 85) return 'Confiável';
  if (score >= 70) return 'Atenção';
  if (score >= 50) return 'Baixa confiança';
  return 'Crítico';
}

function statusToHealth(s: SourceStatus): SourceHealth {
  if (s === 'ok') return 'healthy';
  if (s === 'partial') return 'attention';
  if (s === 'failed' || s === 'unavailable') return 'critical';
  return 'unknown';
}

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function useRevenueHealthTrust() {
  const pipelineHealth = useRevenuePipelineHealth();
  const risks = useRevenueRisks();
  const bottlenecks = useRevenueBottlenecks();
  const today = useRevenueTodayCommand();

  return useMemo<{ data: HealthTrustData | null; isLoading: boolean; error: Error | null }>(() => {
    const isLoading =
      pipelineHealth.isLoading ||
      risks.isLoading ||
      bottlenecks.isLoading ||
      today.isLoading;

    const ph = pipelineHealth.data;
    const rk = risks.data;
    const bn = bottlenecks.data;
    const td = today.data;

    // ─── Mapa de fontes (nome canônico → status)
    const failedFromRisks = new Set(rk?.meta.failedSources ?? []);
    const failedFromBottlenecks = new Set(bn?.meta.failedSources ?? []);
    const failedFromToday = new Set(td?.meta.failedSources ?? []);

    const sourceDefs: Array<{ id: string; label: string }> = [
      { id: 'forecast', label: 'Forecast V2' },
      { id: 'pipeline_sales', label: 'Pipeline de Vendas' },
      { id: 'winloss', label: 'Win/Loss' },
      { id: 'results', label: 'Resultados / Auditoria' },
      { id: 'qualification', label: 'Qualidade de Qualificação' },
      { id: 'pipeline_health', label: 'Pipeline Health' },
      { id: 'revenue_by_seller', label: 'Receita por Vendedor' },
      { id: 'crm_trust', label: 'CRM Trust Score' },
      { id: 'today', label: 'Hoje na Operação' },
    ];

    const resolveStatus = (label: string, fallback: SourceStatus = 'ok'): SourceStatus => {
      const failed =
        failedFromRisks.has(label) ||
        failedFromBottlenecks.has(label) ||
        failedFromToday.has(label) ||
        (label === 'Resultados / Auditoria' && (failedFromRisks.has('Resultados/Auditoria') || failedFromBottlenecks.has('Resultados/Auditoria') || failedFromToday.has('Resultados'))) ||
        (label === 'Qualidade de Qualificação' && (failedFromBottlenecks.has('Qualidade de Qualificação') || failedFromToday.has('Qualidade Qualif.')));
      if (failed) return 'failed';
      return fallback;
    };

    const generatedAt = new Date().toISOString();
    const sources: HealthSource[] = sourceDefs.map((d) => {
      let status: SourceStatus = isLoading ? 'loading' : resolveStatus(d.label);
      let coveragePct: number | null = null;
      let updatedAt: string | null = generatedAt;
      let helper: string | undefined;

      if (d.id === 'pipeline_health' || d.id === 'crm_trust') {
        if (ph?.trustScore == null && !isLoading) status = 'unavailable';
        coveragePct = ph?.trustScore ?? null;
      }
      if (d.id === 'pipeline_sales') {
        if (!ph?.scope.resolved && !isLoading) {
          status = 'unavailable';
          helper = 'Pipeline comercial não configurado.';
        } else {
          coveragePct = ph?.totalOpen ? 100 : 100;
        }
      }
      if (d.id === 'forecast') {
        if (rk?.meta.failedSources.includes('Forecast')) status = 'failed';
      }

      return {
        id: d.id,
        label: d.label,
        status,
        health: statusToHealth(status),
        coveragePct,
        updatedAt,
        helper,
      };
    });

    // ─── Cobertura (a partir do Pipeline Health)
    const total = ph?.totalOpen ?? 0;
    const buildCoverage = (issueId: string, label: string): CoverageItem => {
      const issue = ph?.issues.find((i) => i.id === (issueId as any));
      const missing = issue?.count ?? 0;
      const covered = total > 0 ? Math.max(0, total - missing) : 0;
      const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
      return { id: issueId, label, coveredPct: pct, missingCount: missing, totalCount: total };
    };

    const coverage: CoverageItem[] = total > 0
      ? [
          buildCoverage('no_owner', 'Oportunidades com owner'),
          buildCoverage('no_value', 'Oportunidades com valor'),
          buildCoverage('no_account', 'Oportunidades com empresa'),
          buildCoverage('no_contact', 'Oportunidades com contato'),
          buildCoverage('no_next_activity', 'Oportunidades com próxima atividade'),
          buildCoverage('overdue', 'Oportunidades dentro do prazo'),
        ]
      : [];

    // ─── Problemas detectados (a partir de pipelineHealth.issues, priorizando impacto)
    const issuesRaw = (ph?.issues ?? []).filter((i) => i.count > 0);
    const issueCtaMap: Record<string, { label: string; impactLabel?: string; to: string }> = {
      no_owner: { label: 'Abrir Pipeline', to: '/pipeline' },
      no_value: { label: 'Abrir Pipeline', impactLabel: 'Risco de forecast', to: '/pipeline' },
      no_next_activity: { label: 'Abrir Pipeline', to: '/pipeline' },
      stale: { label: 'Abrir Pipeline', to: '/pipeline' },
      overdue: { label: 'Abrir Pipeline', to: '/pipeline' },
      duplicate: { label: 'Abrir Pipeline', to: '/pipeline' },
      no_account: { label: 'Abrir Pipeline', to: '/pipeline' },
      no_contact: { label: 'Abrir Pipeline', to: '/pipeline' },
    };

    const issues: IssueItem[] = issuesRaw
      .map((i) => {
        const cta = issueCtaMap[i.id];
        const hasValue = i.value > 0;
        return {
          id: String(i.id),
          label: `${i.count} ${i.label.toLowerCase()}`,
          count: i.count,
          impactValue: i.value,
          impactLabel: hasValue ? fmtBRL(i.value) : cta?.impactLabel ?? 'Impacto não monetizável',
          cta: cta ? { label: cta.label, to: cta.to } : undefined,
        };
      })
      .sort((a, b) => b.impactValue - a.impactValue);

    // ─── Impacto financeiro
    const impactItems: FinancialImpactItem[] = issuesRaw
      .filter((i) => i.value > 0)
      .map((i) => ({ id: String(i.id), label: i.label, value: i.value }))
      .sort((a, b) => b.value - a.value);
    const totalImpact = impactItems.reduce((s, i) => s + i.value, 0);

    // ─── Consistência entre fontes (somente quando ambos lados existem)
    const consistency: ConsistencyCheck[] = [];
    const closedTotal = (rk as any)?.blocks?.find?.((b: any) => b.id === 'cancellations')?.impactValue ?? null;
    // Pipeline vs Forecast best case — sinal de consistência grosseira
    const forecastBlock = rk?.blocks.find((b) => b.id === 'pipeline_coverage');
    const pipelineOpenValue = ph?.totalOpenValue ?? null;
    if (forecastBlock && pipelineOpenValue != null) {
      consistency.push({
        id: 'pipeline_vs_forecast',
        label: 'Pipeline aberto vs Forecast',
        left: { label: 'Pipeline aberto', value: pipelineOpenValue },
        right: { label: 'Forecast (referência)', value: forecastBlock.impactValue || 0 },
        diff: Math.abs(pipelineOpenValue - (forecastBlock.impactValue || 0)),
        status: forecastBlock.available ? 'ok' : 'unavailable',
      });
    }
    const cancellationsBlock = rk?.blocks.find((b) => b.id === 'cancellations');
    if (cancellationsBlock) {
      consistency.push({
        id: 'cancellations',
        label: 'Cancelamentos detectados',
        left: { label: 'Receita cancelada', value: cancellationsBlock.impactValue || 0 },
        right: { label: 'Esperado', value: 0 },
        diff: cancellationsBlock.impactValue || 0,
        status: cancellationsBlock.available
          ? cancellationsBlock.impactValue > 0
            ? 'diverged'
            : 'ok'
          : 'unavailable',
      });
    }
    if (closedTotal != null) {
      // placeholder consumption to silence unused var without breaking build
    }

    // ─── Trust score composto
    const failedCount = sources.filter((s) => s.status === 'failed' || s.status === 'unavailable').length;
    const partialCount = sources.filter((s) => s.status === 'partial').length;

    const integrity = Math.max(0, 20 - failedCount * 5 - partialCount * 2);

    const coverageAvg = coverage.length > 0
      ? coverage.reduce((s, c) => s + c.coveredPct, 0) / coverage.length
      : null;
    const coverageScore = coverageAvg != null ? Math.round((coverageAvg / 100) * 20) : 10;

    const freshness = isLoading ? 10 : 20 - Math.min(10, failedCount * 3);

    const phTrust = ph?.trustScore ?? null;
    const hygiene = phTrust != null ? Math.round((phTrust / 100) * 20) : 10;

    const divergedCount = consistency.filter((c) => c.status === 'diverged').length;
    const consistencyScore = Math.max(0, 20 - divergedCount * 5);

    const trustScore =
      ph == null && rk == null
        ? null
        : Math.max(0, Math.min(100, integrity + coverageScore + freshness + hygiene + consistencyScore));
    const trustLabel = classify(trustScore);

    const trustSummary = (() => {
      if (trustScore == null) return 'Sem dados suficientes para calcular a confiança do Revenue Command.';
      if (trustScore >= 95) return 'O Revenue Command está operando com excelente qualidade de dados.';
      if (trustScore >= 85) return 'O Revenue Command está operando com boa qualidade de dados, mas existem pontos que podem impactar previsões e análises.';
      if (trustScore >= 70) return 'Existem sinais de atenção que podem comprometer previsões e decisões.';
      if (trustScore >= 50) return 'A confiança nos números está baixa. Vários módulos apresentam falhas ou falta de cobertura.';
      return 'Confiança crítica. As decisões executivas estão expostas a risco significativo de dados.';
    })();

    // ─── Ações recomendadas (top 5 issues por impacto)
    const actions: RecommendedHealthAction[] = issuesRaw
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((i) => ({
        id: `action_${i.id}`,
        title: i.id === 'no_owner'
          ? 'Corrigir oportunidades sem owner'
          : i.id === 'no_next_activity'
            ? 'Adicionar próxima atividade'
            : i.id === 'no_value'
              ? 'Higienizar oportunidades sem valor'
              : i.id === 'overdue'
                ? 'Atualizar oportunidades vencidas'
                : i.id === 'stale'
                  ? 'Revisar oportunidades paradas'
                  : i.id === 'duplicate'
                    ? 'Remover duplicidades'
                    : `Revisar ${i.label.toLowerCase()}`,
        reason: `${i.count} oportunidades afetadas`,
        impactValue: i.value,
        ctaLabel: 'Abrir Pipeline',
        to: '/pipeline',
      }));

    const data: HealthTrustData = {
      trustScore,
      trustLabel,
      trustSummary,
      breakdown: { integrity, coverage: coverageScore, freshness, hygiene, consistency: consistencyScore },
      sources,
      coverage,
      issues,
      financialImpact: { items: impactItems, total: totalImpact },
      consistency,
      history: { points: [], trend: 'insufficient' },
      actions,
      meta: {
        generatedAt,
        sourceCount: sources.length,
        healthySources: sources.filter((s) => s.health === 'healthy').length,
        warningSources: sources.filter((s) => s.health === 'attention').length,
        failedSources: sources.filter((s) => s.health === 'critical').length,
        confidence: trustLabel,
      },
    };

    return { data, isLoading, error: null };
  }, [
    pipelineHealth.data,
    pipelineHealth.isLoading,
    pipelineHealth.error,
    risks.data,
    risks.isLoading,
    risks.error,
    bottlenecks.data,
    bottlenecks.isLoading,
    bottlenecks.error,
    today.data,
    today.isLoading,
    today.error,
  ]);
}
