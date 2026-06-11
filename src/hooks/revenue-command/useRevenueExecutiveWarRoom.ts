/**
 * Sprint RCC V3.11 — Hook agregador do Executive War Room.
 *
 * Somente leitura. Consolida sinais já existentes do Revenue Command Center
 * em um painel executivo único. Não cria view, não chama IA, não escreve
 * em banco, não altera regra financeira/forecast/comissão.
 *
 * Fontes:
 *  - useRevenueTodayCommand   (situação do mês + meta + realizado)
 *  - useRevenueRisks          (riscos canônicos)
 *  - useRevenueNextActions    (fila executiva)
 *  - useRevenuePipelineHealth (CRM Trust + cobertura)
 *  - useRevenueHealthTrust    (trust score consolidado)
 *  - useRevenuePeople         (dependência de vendedor)
 */
import { useMemo } from 'react';
import { useRevenueTodayCommand } from './useRevenueTodayCommand';
import { useRevenueRisks, type RiskBlock } from './useRevenueRisks';
import { useRevenueNextActions, type NextAction } from './useRevenueNextActions';
import { useRevenuePipelineHealth } from './useRevenuePipelineHealth';
import { useRevenueHealthTrust } from './useRevenueHealthTrust';
import { useRevenuePeople } from './useRevenuePeople';

export type RadarStatus = 'green' | 'yellow' | 'red' | 'unknown';

export interface RadarSignal {
  id: 'goal' | 'forecast' | 'pipeline' | 'quality' | 'people' | 'trust';
  label: string;
  status: RadarStatus;
  reason: string;
}

export interface WarRoomScoreBreakdown {
  goal: { score: number; max: 20 };
  forecast: { score: number; max: 20 };
  pipeline: { score: number; max: 20 };
  quality: { score: number; max: 15 };
  people: { score: number; max: 10 };
  trust: { score: number; max: 15 };
}

export type WarRoomScoreLabel = 'Excelente' | 'Atenção' | 'Risco' | 'Crítico' | 'Indisponível';

export interface WarRoomHealthScore {
  score: number | null;
  label: WarRoomScoreLabel;
  summary: string;
  breakdown: WarRoomScoreBreakdown;
}

export interface WarRoomMonthSituation {
  goal: number;
  realized: number;
  commit: number;
  bestCase: number;
  gap: number;
  daysRemaining: number;
  hasGoal: boolean;
}

export interface WarRoomExecutiveAnswer {
  question: string;
  answer: string;
  driver:
    | 'pipeline_coverage'
    | 'goal'
    | 'forecast_quality'
    | 'seller_dependency'
    | 'revenue_concentration'
    | 'qualification_quality'
    | 'crm_trust_score'
    | 'cancellations'
    | 'none';
  impact: number;
}

export interface WarRoomRiskMini {
  id: string;
  title: string;
  impactLabel: string;
  severity: 'high' | 'medium' | 'low';
  cta: { label: string; to: string };
}

export interface WarRoomActionMini {
  id: string;
  title: string;
  priority: NextAction['priority'];
  impactLabel: string;
  cta: { label: string; to: string };
}

export interface WarRoomTrustMini {
  score: number | null;
  label: string;
  ok: number;
  partial: number;
  failed: number;
  updatedAt: string;
  cta: { label: string; to: string };
}

export interface WarRoomData {
  healthScore: WarRoomHealthScore;
  monthSituation: WarRoomMonthSituation;
  executiveAnswer: WarRoomExecutiveAnswer;
  radar: RadarSignal[];
  topRisks: WarRoomRiskMini[];
  topActions: WarRoomActionMini[];
  trustMini: WarRoomTrustMini;
  meta: {
    generatedAt: string;
    sources: string[];
    partialSources: string[];
    confidence: 'high' | 'medium' | 'low';
  };
}

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

function classifyScore(score: number | null): WarRoomScoreLabel {
  if (score == null) return 'Indisponível';
  if (score >= 90) return 'Excelente';
  if (score >= 75) return 'Atenção';
  if (score >= 60) return 'Risco';
  return 'Crítico';
}

function daysRemainingInMonth(): number {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(0, Math.ceil((last.getTime() - now.getTime()) / 86_400_000));
}

export function useRevenueExecutiveWarRoom(): {
  data: WarRoomData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const today = useRevenueTodayCommand();
  const risks = useRevenueRisks();
  const next = useRevenueNextActions();
  const ph = useRevenuePipelineHealth();
  const trust = useRevenueHealthTrust();
  const people = useRevenuePeople();

  return useMemo(() => {
    const isLoading =
      today.isLoading ||
      risks.isLoading ||
      next.isLoading ||
      ph.isLoading ||
      trust.isLoading ||
      people.isLoading;

    const partialSources: string[] = [];
    if (today.error) partialSources.push('Hoje na Operação');
    if (risks.error) partialSources.push('Riscos');
    if (next.error) partialSources.push('Próximas Ações');
    if (ph.error) partialSources.push('Pipeline Health');
    if (trust.error) partialSources.push('Health & Trust');
    if (people.error) partialSources.push('Pessoas');

    const td = today.data;
    const rk = risks.data;
    const nx = next.data;
    const phData = ph.data;
    const trustData = trust.data;
    const peopleData = people.data;

    // ── Month situation ──────────────────────────────────────────────
    const sb = td?.scoreboard;
    const goalBlock = rk?.blocks.find((b) => b.id === 'goal');
    const goal = sb?.monthlyGoal ?? 0;
    const realized = sb?.validRevenue ?? 0;

    // Commit/Best Case via Risks block metrics (já formatados) — fallback: forecast realistic
    const findMetric = (block: RiskBlock | undefined, label: string): number => {
      const m = block?.metrics.find((x) => x.label === label);
      if (!m) return 0;
      const n = Number(String(m.value).replace(/[^\d,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const commit = findMetric(goalBlock, 'Commit');
    const bestCase = findMetric(goalBlock, 'Best Case') || sb?.forecastRealistic || 0;
    const gap = Math.max(0, goal - realized);
    const monthSituation: WarRoomMonthSituation = {
      goal,
      realized,
      commit,
      bestCase,
      gap,
      daysRemaining: daysRemainingInMonth(),
      hasGoal: goal > 0,
    };

    // ── Score breakdown ──────────────────────────────────────────────
    // Goal (20)
    let goalScore = 5;
    if (goal > 0) {
      if (bestCase >= goal) goalScore = 20;
      else if (bestCase >= 0.8 * goal) goalScore = 12;
      else goalScore = 5;
    } else {
      goalScore = 10;
    }

    // Forecast (20) — NRHS confidence
    const forecastBlock = rk?.blocks.find((b) => b.id === 'forecast_quality');
    const conf = forecastBlock?.level ?? 'medium';
    const forecastScore = conf === 'low' ? 20 : conf === 'medium' ? 12 : 5;

    // Pipeline coverage (20)
    const covBlock = rk?.blocks.find((b) => b.id === 'pipeline_coverage');
    let coverage = 0;
    if (covBlock) {
      const m = covBlock.metrics.find((x) => x.label === 'Cobertura');
      if (m) coverage = Number(String(m.value).replace('x', '').replace(',', '.')) || 0;
    }
    let pipelineScore = 5;
    if (coverage >= 3) pipelineScore = 20;
    else if (coverage >= 2) pipelineScore = 12;
    else pipelineScore = 5;

    // Quality (15) — via qualification block
    const qBlock = rk?.blocks.find((b) => b.id === 'qualification_quality');
    let qualityScore = 8;
    if (qBlock?.available) {
      qualityScore = qBlock.level === 'low' ? 15 : qBlock.level === 'medium' ? 8 : 3;
    } else if (!qBlock || !qBlock.available) {
      qualityScore = 8;
    }

    // People (10) — dependência via concentrationTop1Pct
    const top1Pct = peopleData?.scoreboard.concentrationTop1Pct ?? null;
    let peopleScore = 5;
    if (top1Pct == null) peopleScore = 5;
    else if (top1Pct >= 60) peopleScore = 2;
    else if (top1Pct >= 40) peopleScore = 5;
    else peopleScore = 10;

    // Trust (15)
    const trustVal = trustData?.trustScore ?? null;
    let trustScoreSeg = 8;
    if (trustVal == null) trustScoreSeg = 8;
    else if (trustVal >= 95) trustScoreSeg = 15;
    else if (trustVal >= 85) trustScoreSeg = 12;
    else if (trustVal >= 70) trustScoreSeg = 8;
    else trustScoreSeg = 3;

    const totalScore =
      goalScore + forecastScore + pipelineScore + qualityScore + peopleScore + trustScoreSeg;

    const healthScore: WarRoomHealthScore = {
      score: rk == null && td == null ? null : totalScore,
      label: classifyScore(totalScore),
      summary: (() => {
        const pieces: string[] = [];
        if (goal > 0 && bestCase < goal) pieces.push('meta pressionada');
        if (coverage > 0 && coverage < 2) pieces.push('cobertura abaixo de 2x');
        if (top1Pct && top1Pct >= 40) pieces.push('alta dependência de vendedor');
        if (trustVal != null && trustVal < 70) pieces.push('trust score baixo');
        if (pieces.length === 0) return 'Operação saudável nos principais sinais.';
        return `Principais sinais: ${pieces.join(', ')}.`;
      })(),
      breakdown: {
        goal: { score: goalScore, max: 20 },
        forecast: { score: forecastScore, max: 20 },
        pipeline: { score: pipelineScore, max: 20 },
        quality: { score: qualityScore, max: 15 },
        people: { score: peopleScore, max: 10 },
        trust: { score: trustScoreSeg, max: 15 },
      },
    };

    // ── Executive answer ─────────────────────────────────────────────
    const candidates: Array<{
      driver: WarRoomExecutiveAnswer['driver'];
      impact: number;
      answer: string;
    }> = [];
    if (covBlock?.available && covBlock.level === 'high') {
      candidates.push({
        driver: 'pipeline_coverage',
        impact: covBlock.impactValue,
        answer: `Pipeline insuficiente é o principal bloqueio. Cobertura em ${coverage.toFixed(1)}x, abaixo do mínimo de 2x. Faltam ${fmtBRL(covBlock.impactValue)} em pipeline para sustentar a meta.`,
      });
    }
    if (goalBlock?.available && goalBlock.level !== 'low') {
      candidates.push({
        driver: 'goal',
        impact: goalBlock.impactValue || gap,
        answer: `Meta em risco: ${goalBlock.diagnosis}`,
      });
    }
    if (forecastBlock?.available && forecastBlock.level === 'high') {
      candidates.push({
        driver: 'forecast_quality',
        impact: forecastBlock.impactValue,
        answer: `Forecast fraco: ${forecastBlock.diagnosis}`,
      });
    }
    const depBlock = rk?.blocks.find((b) => b.id === 'seller_dependency');
    if (depBlock?.available && depBlock.level === 'high') {
      candidates.push({
        driver: 'seller_dependency',
        impact: depBlock.impactValue,
        answer: `Dependência de vendedor: ${depBlock.diagnosis}`,
      });
    }
    const concBlock = rk?.blocks.find((b) => b.id === 'revenue_concentration');
    if (concBlock?.available && concBlock.level === 'high') {
      candidates.push({
        driver: 'revenue_concentration',
        impact: concBlock.impactValue,
        answer: `Receita concentrada: ${concBlock.diagnosis}`,
      });
    }
    const qualBlock = rk?.blocks.find((b) => b.id === 'qualification_quality');
    if (qualBlock?.available && qualBlock.level === 'high') {
      candidates.push({
        driver: 'qualification_quality',
        impact: qualBlock.impactValue,
        answer: `Qualidade de qualificação baixa: ${qualBlock.diagnosis}`,
      });
    }
    const trustBlock = rk?.blocks.find((b) => b.id === 'crm_trust_score');
    if (trustBlock?.available && trustBlock.level === 'high') {
      candidates.push({
        driver: 'crm_trust_score',
        impact: trustBlock.impactValue,
        answer: `CRM Trust baixo: ${trustBlock.diagnosis}`,
      });
    }
    const cancBlock = rk?.blocks.find((b) => b.id === 'cancellations');
    if (cancBlock?.available && cancBlock.level === 'high') {
      candidates.push({
        driver: 'cancellations',
        impact: cancBlock.impactValue,
        answer: `Cancelamentos relevantes: ${cancBlock.diagnosis}`,
      });
    }
    candidates.sort((a, b) => b.impact - a.impact);
    const top = candidates[0];
    const executiveAnswer: WarRoomExecutiveAnswer = top
      ? { question: 'O que está impedindo a meta?', answer: top.answer, driver: top.driver, impact: top.impact }
      : {
          question: 'O que está impedindo a meta?',
          answer:
            goal > 0 && realized >= goal
              ? 'Meta atingida. Mantenha foco em higiene e cobertura para os próximos ciclos.'
              : 'Nenhum bloqueio crítico identificado nas fontes oficiais no momento.',
          driver: 'none',
          impact: 0,
        };

    // ── Radar (6 sinais) ─────────────────────────────────────────────
    const levelToStatus = (lvl: 'low' | 'medium' | 'high' | undefined): RadarStatus =>
      lvl === 'high' ? 'red' : lvl === 'medium' ? 'yellow' : lvl === 'low' ? 'green' : 'unknown';

    const radar: RadarSignal[] = [
      {
        id: 'goal',
        label: 'Meta',
        status: goalBlock ? levelToStatus(goalBlock.level) : 'unknown',
        reason: goalBlock?.status ?? 'Sem dados de meta.',
      },
      {
        id: 'forecast',
        label: 'Forecast',
        status: forecastBlock ? levelToStatus(forecastBlock.level) : 'unknown',
        reason: forecastBlock?.status ?? 'Sem dados de forecast.',
      },
      {
        id: 'pipeline',
        label: 'Pipeline',
        status: covBlock ? levelToStatus(covBlock.level) : 'unknown',
        reason: covBlock?.status ?? 'Sem dados de cobertura.',
      },
      {
        id: 'quality',
        label: 'Qualidade',
        status: qualBlock ? levelToStatus(qualBlock.level) : 'unknown',
        reason: qualBlock?.status ?? 'Sem dados de qualidade.',
      },
      {
        id: 'people',
        label: 'Pessoas',
        status: depBlock ? levelToStatus(depBlock.level) : 'unknown',
        reason: depBlock?.status ?? 'Sem dados de pessoas.',
      },
      {
        id: 'trust',
        label: 'Trust',
        status:
          trustVal == null
            ? 'unknown'
            : trustVal >= 85
              ? 'green'
              : trustVal >= 70
                ? 'yellow'
                : 'red',
        reason: trustData?.trustSummary ?? 'Sem dados de trust.',
      },
    ];

    // ── Top 3 Risks ──────────────────────────────────────────────────
    const ranking = (rk?.ranking ?? []).filter((b) => b.available);
    const topRisks: WarRoomRiskMini[] = ranking.slice(0, 3).map((b) => ({
      id: b.id,
      title: b.title,
      impactLabel: b.impactValue > 0 ? fmtBRL(b.impactValue) : b.impactHelper ?? '—',
      severity: b.level,
      cta: b.cta,
    }));

    // ── Top 3 Actions ────────────────────────────────────────────────
    const topActions: WarRoomActionMini[] = (nx?.actions ?? []).slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title,
      priority: a.priority,
      impactLabel: a.impactLabel,
      cta: a.primaryCta
        ? { label: a.primaryCta.label, to: a.primaryCta.href }
        : { label: 'Abrir', to: '/app/revenue-command' },
    }));

    // ── Trust Mini ───────────────────────────────────────────────────
    const trustMini: WarRoomTrustMini = {
      score: trustVal,
      label: trustData?.trustLabel ?? 'Indisponível',
      ok: trustData?.meta.healthySources ?? 0,
      partial: trustData?.meta.warningSources ?? 0,
      failed: trustData?.meta.failedSources ?? 0,
      updatedAt: trustData?.meta.generatedAt ?? new Date().toISOString(),
      cta: { label: 'Abrir Health & Trust', to: '/app/revenue-command?tab=health-trust' },
    };

    const confidence: WarRoomData['meta']['confidence'] =
      partialSources.length === 0 ? 'high' : partialSources.length <= 2 ? 'medium' : 'low';

    const data: WarRoomData = {
      healthScore,
      monthSituation,
      executiveAnswer,
      radar,
      topRisks,
      topActions,
      trustMini,
      meta: {
        generatedAt: new Date().toISOString(),
        sources: ['Hoje', 'Riscos', 'Próximas Ações', 'Pipeline Health', 'Health & Trust', 'Pessoas'],
        partialSources,
        confidence,
      },
    };

    return { data, isLoading, error: null };
  }, [
    today.data, today.isLoading, today.error,
    risks.data, risks.isLoading, risks.error,
    next.data, next.isLoading, next.error,
    ph.data, ph.isLoading, ph.error,
    trust.data, trust.isLoading, trust.error,
    people.data, people.isLoading, people.error,
  ]);
}
