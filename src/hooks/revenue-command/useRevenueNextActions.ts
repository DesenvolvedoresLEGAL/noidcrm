/**
 * Sprint RCC V3.7 — Hook agregador da aba "Próximas Ações".
 *
 * Consome SOMENTE sinais já existentes (Risks, Pipeline Health, Bottlenecks)
 * e consolida em uma fila de decisão executiva, priorizada por impacto e
 * urgência.
 *
 * Não cria task, não chama IA, não altera oportunidades, não cria view,
 * não cria edge function e não altera regra financeira.
 */
import { useMemo } from 'react';
import { useRevenueRisks } from './useRevenueRisks';
import { useRevenuePipelineHealth } from './useRevenuePipelineHealth';
import { useRevenueBottlenecks } from './useRevenueBottlenecks';

export type NextActionCategory =
  | 'forecast'
  | 'pipeline'
  | 'quality'
  | 'audit'
  | 'win_loss'
  | 'people'
  | 'health'
  | 'today';

export type NextActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface NextAction {
  id: string;
  title: string;
  category: NextActionCategory;
  priority: NextActionPriority;
  priorityScore: number;
  reason: string;
  impactType: 'financial' | 'operational';
  impactAmount?: number;
  impactLabel: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export interface NextActionsSummary {
  totalActions: number;
  criticalCount: number;
  highCount: number;
  estimatedImpact: number;     // Σ financial impact
  protectedRevenue: number;    // soma de impactos de Pipeline Health / Risks de defesa
  acceleratableRevenue: number; // soma de impactos de Pipeline/Forecast/Quality (aceleração)
}

export interface NextActionsData {
  summary: NextActionsSummary;
  actions: NextAction[];
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

function scoreFor(args: {
  impact: number;
  severity: number;   // 0..40
  urgency: number;    // 0..30
  confidence: number; // 0..15
  effort: number;     // 0..10 (subtraído)
}) {
  // Normaliza impacto financeiro em faixa 0..30 (≥ R$ 500k = 30).
  const impactNorm = Math.min(30, Math.log10(Math.max(1, args.impact + 1)) * 6);
  const raw =
    args.severity + args.urgency + args.confidence - args.effort + impactNorm;
  return Math.max(0, Math.min(100, Math.round(raw + 25)));
}

function classify(score: number): NextActionPriority {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function useRevenueNextActions() {
  const risks = useRevenueRisks();
  const health = useRevenuePipelineHealth();
  const bottlenecks = useRevenueBottlenecks();

  return useMemo<{ data: NextActionsData | null; isLoading: boolean; error: Error | null }>(() => {
    const isLoading = risks.isLoading || health.isLoading || bottlenecks.isLoading;

    const partial: string[] = [];
    if (risks.error) partial.push('Riscos');
    if (health.error) partial.push('Pipeline Health');
    if (bottlenecks.error) partial.push('Gargalos');

    const actions: NextAction[] = [];

    // ── RISCOS (forecast, cobertura, concentração, dependência, qualif, canc, trust) ──
    const r = risks.data;
    if (r) {
      const findBlock = (id: string) => r.blocks.find((b) => b.id === id);
      const goal = findBlock('goal');
      const cov = findBlock('pipeline_coverage');
      const conc = findBlock('revenue_concentration');
      const dep = findBlock('seller_dependency');
      const fq = findBlock('forecast_quality');
      const canc = findBlock('cancellations');
      const qq = findBlock('qualification_quality');
      const trust = findBlock('crm_trust_score');

      if (goal && goal.available && goal.level !== 'low') {
        const sev = goal.level === 'high' ? 40 : 25;
        const score = scoreFor({ impact: goal.impactValue, severity: sev, urgency: 25, confidence: 12, effort: 3 });
        actions.push({
          id: 'risk_goal',
          title: 'Proteger meta do período',
          category: 'forecast',
          priority: classify(score),
          priorityScore: score,
          reason: goal.diagnosis,
          impactType: 'financial',
          impactAmount: goal.impactValue,
          impactLabel: goal.impactValue > 0 ? fmtBRL(goal.impactValue) : 'Sem lacuna',
          confidence: 'high',
          source: 'Riscos → Meta em risco',
          primaryCta: { label: 'Abrir Forecast', href: '/app/forecast' },
        });
      }

      if (cov && cov.available && cov.level !== 'low') {
        const sev = cov.level === 'high' ? 38 : 22;
        const score = scoreFor({ impact: cov.impactValue, severity: sev, urgency: 22, confidence: 13, effort: 4 });
        actions.push({
          id: 'risk_coverage',
          title: 'Aumentar cobertura do pipeline',
          category: 'pipeline',
          priority: classify(score),
          priorityScore: score,
          reason: cov.diagnosis,
          impactType: 'financial',
          impactAmount: cov.impactValue,
          impactLabel: cov.impactValue > 0 ? fmtBRL(cov.impactValue) : 'Cobertura adequada',
          confidence: 'high',
          source: 'Riscos → Pipeline insuficiente',
          primaryCta: { label: 'Abrir Pipeline', href: '/app/pipeline' },
          secondaryCta: { label: 'Abrir Forecast', href: '/app/forecast' },
        });
      }

      if (conc && conc.available && conc.level !== 'low') {
        const sev = conc.level === 'high' ? 32 : 18;
        const score = scoreFor({ impact: conc.impactValue, severity: sev, urgency: 18, confidence: 12, effort: 5 });
        actions.push({
          id: 'risk_concentration',
          title: 'Reduzir concentração de receita',
          category: 'pipeline',
          priority: classify(score),
          priorityScore: score,
          reason: conc.diagnosis,
          impactType: 'financial',
          impactAmount: conc.impactValue,
          impactLabel: fmtBRL(conc.impactValue),
          confidence: 'high',
          source: 'Riscos → Receita concentrada',
          primaryCta: { label: 'Abrir Pipeline', href: '/app/pipeline' },
        });
      }

      if (dep && dep.available && dep.level !== 'low') {
        const sev = dep.level === 'high' ? 32 : 18;
        const score = scoreFor({ impact: dep.impactValue, severity: sev, urgency: 15, confidence: 11, effort: 6 });
        actions.push({
          id: 'risk_dependency',
          title: 'Reduzir dependência de vendedor',
          category: 'people',
          priority: classify(score),
          priorityScore: score,
          reason: dep.diagnosis,
          impactType: 'financial',
          impactAmount: dep.impactValue,
          impactLabel: fmtBRL(dep.impactValue),
          // Pessoas ainda não 100% confiável — manter média
          confidence: 'medium',
          source: 'Riscos → Dependência de vendedor',
          primaryCta: { label: 'Abrir Desempenho', href: '/app/objetivos/desempenho' },
        });
      }

      if (fq && fq.available && fq.level !== 'low') {
        const sev = fq.level === 'high' ? 30 : 18;
        const score = scoreFor({ impact: fq.impactValue, severity: sev, urgency: 18, confidence: 11, effort: 4 });
        actions.push({
          id: 'risk_forecast_quality',
          title: 'Revisar forecast com baixa confiança',
          category: 'forecast',
          priority: classify(score),
          priorityScore: score,
          reason: fq.diagnosis,
          impactType: 'financial',
          impactAmount: fq.impactValue,
          impactLabel: fq.impactValue > 0 ? fmtBRL(fq.impactValue) : 'Sem valor excluído',
          confidence: fq.impactValue > 0 ? 'high' : 'medium',
          source: 'Riscos → Forecast fraco',
          primaryCta: { label: 'Abrir Forecast', href: '/app/forecast' },
        });
      }

      if (canc && canc.available && canc.level !== 'low') {
        const sev = canc.level === 'high' ? 30 : 16;
        const score = scoreFor({ impact: canc.impactValue, severity: sev, urgency: 16, confidence: 13, effort: 5 });
        actions.push({
          id: 'risk_cancellations',
          title: 'Auditar cancelamentos do período',
          category: 'audit',
          priority: classify(score),
          priorityScore: score,
          reason: canc.diagnosis,
          impactType: 'financial',
          impactAmount: canc.impactValue,
          impactLabel: fmtBRL(canc.impactValue),
          confidence: 'high',
          source: 'Riscos → Cancelamentos',
          primaryCta: { label: 'Abrir Auditoria', href: '/app/objetivos/resultados' },
        });
      }

      if (qq && qq.available && qq.level !== 'low') {
        const sev = qq.level === 'high' ? 28 : 15;
        // Operacional: usa quantidade no impactLabel
        const withoutMatch = /(\d+)\s*SQL/i.exec(qq.impactHelper ?? '');
        const without = withoutMatch ? Number(withoutMatch[1]) : 0;
        const score = scoreFor({ impact: 0, severity: sev, urgency: 18, confidence: 10, effort: 4 });
        actions.push({
          id: 'risk_qualification',
          title: 'Transformar SQLs parados em proposta',
          category: 'quality',
          priority: classify(score),
          priorityScore: score,
          reason: qq.diagnosis,
          impactType: 'operational',
          impactLabel: without > 0 ? `Impacto operacional: ${without} SQLs` : qq.impactHelper ?? 'Impacto operacional',
          confidence: 'medium',
          source: 'Riscos → Qualidade de qualificação',
          primaryCta: { label: 'Abrir Qualidade', href: '/app/objetivos/desempenho' },
        });
      }

      if (trust && trust.available && trust.level !== 'low') {
        const sev = trust.level === 'high' ? 30 : 18;
        const score = scoreFor({ impact: trust.impactValue, severity: sev, urgency: 20, confidence: 12, effort: 3 });
        actions.push({
          id: 'risk_trust',
          title: 'Higienizar dados críticos do CRM',
          category: 'health',
          priority: classify(score),
          priorityScore: score,
          reason: trust.diagnosis,
          impactType: 'financial',
          impactAmount: trust.impactValue,
          impactLabel: trust.impactValue > 0 ? fmtBRL(trust.impactValue) : 'Sem valor higienizável',
          confidence: trust.impactValue > 0 ? 'high' : 'medium',
          source: 'Riscos → CRM Trust Score',
          primaryCta: { label: 'Abrir Pipeline Health', href: '/app/revenue-command?tab=pipeline' },
        });
      }
    }

    // ── PIPELINE HEALTH — issues operacionais com valor financeiro ──
    const ph = health.data;
    if (ph && !ph.isEmpty) {
      const issueMap: Record<string, { title: string; severity: number }> = {
        no_next_activity: { title: 'Atualizar oportunidades sem próxima atividade', severity: 24 },
        overdue: { title: 'Corrigir oportunidades vencidas', severity: 32 },
        stale: { title: 'Reativar oportunidades paradas há +14 dias', severity: 26 },
        no_owner: { title: 'Atribuir owner para oportunidades sem responsável', severity: 22 },
        no_value: { title: 'Preencher valor de oportunidades sem valor', severity: 18 },
        duplicate: { title: 'Resolver oportunidades possivelmente duplicadas', severity: 28 },
      };

      for (const issue of ph.issues) {
        if (issue.count === 0) continue;
        const meta = issueMap[issue.id];
        if (!meta) continue;
        const hasValue = issue.value > 0;
        const score = scoreFor({
          impact: issue.value,
          severity: meta.severity,
          urgency: issue.id === 'overdue' ? 25 : 18,
          confidence: hasValue ? 12 : 8,
          effort: 3,
        });
        actions.push({
          id: `health_${issue.id}`,
          title: meta.title,
          category: 'health',
          priority: classify(score),
          priorityScore: score,
          reason: `${issue.count} oportunidade(s) com problema "${issue.label}".`,
          impactType: hasValue ? 'financial' : 'operational',
          impactAmount: hasValue ? issue.value : undefined,
          impactLabel: hasValue
            ? fmtBRL(issue.value)
            : `Impacto operacional: ${issue.count} oportunidades`,
          confidence: hasValue ? 'high' : 'medium',
          source: 'Pipeline Health',
          primaryCta: { label: 'Abrir Pipeline', href: '/app/pipeline' },
          secondaryCta: { label: 'Abrir Pipeline Health', href: '/app/revenue-command?tab=pipeline' },
        });
      }
    }

    // ── GARGALOS — motivo de perda dominante ──
    const b = bottlenecks.data;
    if (b) {
      const topLoss = b.lossReasons?.[0];
      if (topLoss && topLoss.count > 0) {
        const score = scoreFor({
          impact: topLoss.lostValue,
          severity: 24,
          urgency: 15,
          confidence: topLoss.lostValue > 0 ? 12 : 9,
          effort: 6,
        });
        actions.push({
          id: 'loss_top_reason',
          title: 'Atacar principal motivo de perda',
          category: 'win_loss',
          priority: classify(score),
          priorityScore: score,
          reason: `"${topLoss.reason}" responde por ${topLoss.pct.toFixed(0)}% das perdas (${topLoss.count}).`,
          impactType: topLoss.lostValue > 0 ? 'financial' : 'operational',
          impactAmount: topLoss.lostValue > 0 ? topLoss.lostValue : undefined,
          impactLabel:
            topLoss.lostValue > 0
              ? fmtBRL(topLoss.lostValue)
              : `Impacto operacional: ${topLoss.count} deals perdidos`,
          confidence: topLoss.lostValue > 0 ? 'high' : 'medium',
          source: 'Win/Loss Hub',
          primaryCta: { label: 'Abrir Win/Loss', href: '/app/reports?tab=win-loss' },
        });
      }
    }

    // Dedup por id (segurança) + sort por score desc.
    const seen = new Set<string>();
    const deduped = actions.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
    deduped.sort((a, b) => b.priorityScore - a.priorityScore);

    // Summary
    const criticalCount = deduped.filter((a) => a.priority === 'critical').length;
    const highCount = deduped.filter((a) => a.priority === 'high').length;
    const estimatedImpact = deduped.reduce((s, a) => s + (a.impactAmount ?? 0), 0);

    // Receita protegida: ações defensivas (health, audit, win_loss).
    const protectedRevenue = deduped
      .filter((a) => ['health', 'audit', 'win_loss'].includes(a.category))
      .reduce((s, a) => s + (a.impactAmount ?? 0), 0);
    // Receita acelerável: ações de execução (pipeline, forecast, quality).
    const acceleratableRevenue = deduped
      .filter((a) => ['pipeline', 'forecast', 'quality'].includes(a.category))
      .reduce((s, a) => s + (a.impactAmount ?? 0), 0);

    const summary: NextActionsSummary = {
      totalActions: deduped.length,
      criticalCount,
      highCount,
      estimatedImpact,
      protectedRevenue,
      acceleratableRevenue,
    };

    const confidence: NextActionsData['meta']['confidence'] =
      partial.length === 0 ? 'high' : partial.length === 1 ? 'medium' : 'low';

    const data: NextActionsData = {
      summary,
      actions: deduped,
      meta: {
        generatedAt: new Date().toISOString(),
        sources: ['Riscos', 'Pipeline Health', 'Gargalos', 'Win/Loss', 'Forecast V2', 'Qualidade de Qualificação'],
        partialSources: partial,
        confidence,
      },
    };

    return { data, isLoading, error: null };
  }, [risks.data, risks.isLoading, risks.error, health.data, health.isLoading, health.error, bottlenecks.data, bottlenecks.isLoading, bottlenecks.error]);
}
