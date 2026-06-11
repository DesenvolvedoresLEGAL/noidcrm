/**
 * Sprint RCC V3.10 — Revenue Copilot (read-only)
 *
 * Camada de Q&A executiva que consome APENAS hooks já existentes
 * do Revenue Command Center. Não executa ações, não escreve no banco,
 * não cria edge functions e não usa fontes paralelas.
 *
 * Fluxo: pergunta -> intent (regex) -> consulta hooks -> resposta executiva
 * (RESUMO, EVIDÊNCIAS, IMPACTO, PRÓXIMA AÇÃO) + fontes + links + confiança.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRevenueTodayCommand } from './useRevenueTodayCommand';
import { useRevenueRisks } from './useRevenueRisks';
import { useRevenuePipelineHealth } from './useRevenuePipelineHealth';
import { useRevenueBottlenecks } from './useRevenueBottlenecks';
import { useRevenuePeople } from './useRevenuePeople';
import { useRevenueNextActions } from './useRevenueNextActions';
import { useRevenueHealthTrust } from './useRevenueHealthTrust';

export type CopilotIntent =
  | 'goal_risk'
  | 'goal_gap'
  | 'forecast_projection'
  | 'goal_impact_people'
  | 'pipeline_sufficiency'
  | 'pipeline_stuck_stage'
  | 'pipeline_value_stuck'
  | 'people_top'
  | 'people_help'
  | 'people_best'
  | 'people_risk'
  | 'winloss_reason'
  | 'winloss_lost_value'
  | 'forecast_trust'
  | 'forecast_commit'
  | 'forecast_bestcase'
  | 'quality_sqls'
  | 'quality_sdr_risk'
  | 'trust_score'
  | 'trust_failing'
  | 'action_today'
  | 'action_most_important'
  | 'unknown';

export interface CopilotLink {
  label: string;
  to: string;
}

export interface CopilotEvidence {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'bad';
}

export type CopilotConfidence = 'high' | 'medium' | 'low';

export interface CopilotAnswer {
  intent: CopilotIntent;
  summary: string;
  evidence: CopilotEvidence[];
  impact: string | null;
  nextAction: string | null;
  links: CopilotLink[];
  sources: string[];
  confidence: CopilotConfidence;
  hasData: boolean;
}

export const COPILOT_SUGGESTIONS: { label: string; question: string }[] = [
  { label: 'Por que a meta está em risco?', question: 'Por que a meta está em risco?' },
  { label: 'Quem precisa de ajuda?', question: 'Quem precisa de ajuda?' },
  { label: 'Qual o maior gargalo?', question: 'Qual o maior gargalo hoje?' },
  { label: 'Quanto pipeline falta?', question: 'Quanto pipeline falta para bater a meta?' },
  { label: 'Principal motivo de perda?', question: 'Qual o principal motivo de perda?' },
  { label: 'Posso confiar nos dados?', question: 'Posso confiar nesses dados?' },
  { label: 'O que devo fazer hoje?', question: 'O que eu deveria fazer hoje?' },
];

function fmtBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}
function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

function detectIntent(qRaw: string): CopilotIntent {
  const q = qRaw.toLowerCase().trim();
  if (!q) return 'unknown';
  // Trust
  if (/(posso confiar|confio|trust|confian[çc]a nos dados|dados.*confi)/.test(q)) return 'trust_score';
  if (/(fonte.*falh|fontes.*quebr|fontes.*indispon|qual.*fonte.*falh)/.test(q)) return 'trust_failing';
  if (/(crm trust|trust score)/.test(q)) return 'trust_score';
  // Forecast
  if (/(confiar no forecast|forecast.*confi)/.test(q)) return 'forecast_trust';
  if (/(commit)/.test(q)) return 'forecast_commit';
  if (/(best case|melhor cen[áa]rio)/.test(q)) return 'forecast_bestcase';
  if (/(proje[çc][ãa]o.*m[êe]s|forecast.*m[êe]s|qual.*proje[çc][ãa]o)/.test(q)) return 'forecast_projection';
  // Goal
  if (/(meta.*risco|por que.*meta|meta em risco)/.test(q)) return 'goal_risk';
  if (/(quanto falta.*meta|gap.*meta|falta.*bater)/.test(q)) return 'goal_gap';
  if (/(quem.*impacta.*meta|quem.*mais impacta)/.test(q)) return 'goal_impact_people';
  // Pipeline
  if (/(pipeline.*suficien|cobertura)/.test(q)) return 'pipeline_sufficiency';
  if (/(etapa.*trav|onde.*morrem|negocios.*morrem|neg[óo]cios morrem|maior gargalo|onde travam)/.test(q))
    return 'pipeline_stuck_stage';
  if (/(valor.*parado|quanto.*parado|dinheiro parado)/.test(q)) return 'pipeline_value_stuck';
  // People
  if (/(quem.*carreg|quem est[áa] puxando|top performer)/.test(q)) return 'people_top';
  if (/(quem precisa.*ajuda|quem precisa de ajuda)/.test(q)) return 'people_help';
  if (/(melhor performance|melhor vendedor|melhor sdr)/.test(q)) return 'people_best';
  if (/(maior risco.*pessoa|quem tem maior risco)/.test(q)) return 'people_risk';
  // Win/Loss
  if (/(principal motivo de perda|por que.*perdendo|motivo.*perda)/.test(q)) return 'winloss_reason';
  if (/(quanto.*perdido|quanto dinheiro foi perdido|valor perdido)/.test(q)) return 'winloss_lost_value';
  // Quality
  if (/(sqls? sem proposta|qualifica[çc][ãa]o.*sem proposta)/.test(q)) return 'quality_sqls';
  if (/(qualidade.*qualifica|como est[áa].*qualifica)/.test(q)) return 'quality_sqls';
  if (/(sdr.*risco|qual sdr.*mais risco)/.test(q)) return 'quality_sdr_risk';
  // Action
  if (/(o que.*fazer hoje|fazer hoje|devo fazer)/.test(q)) return 'action_today';
  if (/(a[çc][ãa]o mais importante|prioridade.*hoje|maior impacto)/.test(q)) return 'action_most_important';
  return 'unknown';
}

const NO_DATA_MSG = 'Não encontrei dados suficientes para responder essa pergunta.';

export function useRevenueCopilot() {
  const today = useRevenueTodayCommand();
  const risks = useRevenueRisks();
  const pipeline = useRevenuePipelineHealth();
  const bottlenecks = useRevenueBottlenecks();
  const people = useRevenuePeople();
  const nextActions = useRevenueNextActions();
  const health = useRevenueHealthTrust();

  const [question, setQuestion] = useState<string>('');
  const [submitted, setSubmitted] = useState<string>('');

  const isLoading =
    today.isLoading ||
    risks.isLoading ||
    pipeline.isLoading ||
    bottlenecks.isLoading ||
    people.isLoading ||
    nextActions.isLoading ||
    health.isLoading;

  const ask = useCallback((q: string) => {
    setQuestion(q);
    setSubmitted(q);
  }, []);

  const reset = useCallback(() => {
    setQuestion('');
    setSubmitted('');
  }, []);

  const answer: CopilotAnswer | null = useMemo(() => {
    if (!submitted.trim()) return null;
    if (isLoading) return null;

    const intent = detectIntent(submitted);
    const t = today.data;
    const r = risks.data;
    const p = pipeline.data;
    const b = bottlenecks.data;
    const pe = people.data;
    const na = nextActions.data;
    const h = health.data;

    const sources: Set<string> = new Set();
    const links: CopilotLink[] = [];
    const evidence: CopilotEvidence[] = [];
    let summary = '';
    let impact: string | null = null;
    let nextAction: string | null = null;
    let hasData = true;

    const addLink = (label: string, to: string) => {
      if (!links.find((l) => l.to === to)) links.push({ label, to });
    };

    const goalBlock = r?.blocks.find((x) => x.id === 'goal');
    const coverageBlock = r?.blocks.find((x) => x.id === 'pipeline_coverage');
    const concentrationBlock = r?.blocks.find((x) => x.id === 'revenue_concentration');
    const forecastBlock = r?.blocks.find((x) => x.id === 'forecast_quality');
    const qualBlock = r?.blocks.find((x) => x.id === 'qualification_quality');
    const trustBlock = r?.blocks.find((x) => x.id === 'crm_trust_score');

    switch (intent) {
      case 'goal_risk': {
        if (!t || !r) {
          hasData = false;
          break;
        }
        sources.add('Hoje na Operação');
        sources.add('Riscos');
        const goal = t.scoreboard.monthlyGoal;
        const realized = t.scoreboard.validRevenue;
        const gap = Math.max(0, goal - realized);
        summary = `A meta de ${fmtBRL(goal)} está em risco: já realizou ${fmtBRL(realized)} (${fmtPct(t.scoreboard.goalAttainmentPct)}), faltando ${fmtBRL(gap)}.`;
        evidence.push({ label: 'Meta do mês', value: fmtBRL(goal) });
        evidence.push({ label: 'Realizado', value: fmtBRL(realized), tone: 'neutral' });
        evidence.push({ label: 'Gap', value: fmtBRL(gap), tone: 'bad' });
        if (t.scoreboard.forecastRealistic != null) {
          evidence.push({ label: 'Forecast realista', value: fmtBRL(t.scoreboard.forecastRealistic) });
        }
        if (coverageBlock?.available) {
          evidence.push({ label: 'Cobertura de pipeline', value: coverageBlock.status, tone: coverageBlock.level === 'high' ? 'bad' : 'neutral' });
        }
        if (concentrationBlock?.available) {
          evidence.push({ label: 'Concentração de receita', value: concentrationBlock.status, tone: concentrationBlock.level === 'high' ? 'bad' : 'neutral' });
        }
        if (forecastBlock?.available) {
          evidence.push({ label: 'Qualidade do forecast', value: forecastBlock.status });
        }
        impact = `Receita em risco: ${fmtBRL(gap)}`;
        nextAction = 'Revisar oportunidades sem score, abrir Forecast e Pipeline Health para fechar o gap.';
        addLink('Abrir Forecast', '/app/reports/forecast');
        addLink('Abrir Pipeline', '/app/opportunities');
        addLink('Abrir Riscos', '/app/revenue-command?tab=riscos');
        break;
      }
      case 'goal_gap': {
        if (!t) {
          hasData = false;
          break;
        }
        sources.add('Hoje na Operação');
        const goal = t.scoreboard.monthlyGoal;
        const realized = t.scoreboard.validRevenue;
        const gap = Math.max(0, goal - realized);
        summary = `Faltam ${fmtBRL(gap)} para bater a meta de ${fmtBRL(goal)} (${fmtPct(t.scoreboard.goalAttainmentPct)} atingidos).`;
        evidence.push({ label: 'Meta', value: fmtBRL(goal) });
        evidence.push({ label: 'Realizado', value: fmtBRL(realized) });
        evidence.push({ label: 'Gap', value: fmtBRL(gap), tone: 'bad' });
        impact = fmtBRL(gap);
        nextAction = 'Priorizar deals com maior probabilidade no Pipeline Health.';
        addLink('Abrir Pipeline', '/app/opportunities');
        addLink('Abrir Forecast', '/app/reports/forecast');
        break;
      }
      case 'forecast_projection':
      case 'forecast_bestcase':
      case 'forecast_commit':
      case 'forecast_trust': {
        if (!t && !r) {
          hasData = false;
          break;
        }
        sources.add('Hoje na Operação');
        sources.add('Riscos');
        const fc = t?.scoreboard.forecastRealistic ?? null;
        summary =
          intent === 'forecast_trust'
            ? `Confiança no forecast: ${forecastBlock?.status ?? '—'}. ${forecastBlock?.diagnosis ?? ''}`
            : `Projeção atual (realista): ${fmtBRL(fc)}.`;
        if (fc != null) evidence.push({ label: 'Forecast realista', value: fmtBRL(fc) });
        if (forecastBlock?.available) {
          forecastBlock.metrics.forEach((m) => evidence.push({ label: m.label, value: m.value, tone: m.tone }));
        }
        if (t) {
          evidence.push({ label: 'Meta', value: fmtBRL(t.scoreboard.monthlyGoal) });
          evidence.push({ label: 'Realizado', value: fmtBRL(t.scoreboard.validRevenue) });
        }
        impact = fc != null && t ? `Gap projetado: ${fmtBRL(Math.max(0, t.scoreboard.monthlyGoal - fc))}` : null;
        nextAction = 'Abrir Forecast para revisar premissas e oportunidades sem qualificação.';
        addLink('Abrir Forecast', '/app/reports/forecast');
        addLink('Abrir Riscos', '/app/revenue-command?tab=riscos');
        break;
      }
      case 'goal_impact_people': {
        if (!pe) {
          hasData = false;
          break;
        }
        sources.add('Pessoas');
        const top = pe.topPerformers.slice(0, 3);
        if (top.length === 0) {
          hasData = false;
          break;
        }
        summary = `Quem mais impacta a meta hoje: ${top.map((x) => x.name).join(', ')}.`;
        top.forEach((x) =>
          evidence.push({ label: `${x.name} (${x.role})`, value: x.contribution, tone: 'good' })
        );
        if (pe.concentration.top1Pct != null) {
          impact = `Top 1 concentra ${fmtPct(pe.concentration.top1Pct)} da receita`;
        }
        nextAction = 'Reduzir concentração — desenvolver os Closers da camada de Ajuda.';
        addLink('Abrir Desempenho', '/app/objetivos/desempenho');
        addLink('Abrir Pessoas', '/app/revenue-command?tab=pessoas');
        break;
      }
      case 'pipeline_sufficiency': {
        if (!coverageBlock || !coverageBlock.available) {
          if (!p) {
            hasData = false;
            break;
          }
        }
        sources.add('Riscos');
        sources.add('Pipeline Health');
        summary = coverageBlock
          ? `Cobertura de pipeline: ${coverageBlock.status}. ${coverageBlock.diagnosis}`
          : 'Análise de cobertura disponível em Pipeline Health.';
        coverageBlock?.metrics.forEach((m) => evidence.push({ label: m.label, value: m.value, tone: m.tone }));
        impact = coverageBlock ? `Gap a cobrir: ${fmtBRL(coverageBlock.impactValue)}` : null;
        nextAction = 'Aumentar geração de pipeline e priorizar deals quentes.';
        addLink('Abrir Pipeline', '/app/opportunities');
        addLink('Abrir Forecast', '/app/reports/forecast');
        break;
      }
      case 'pipeline_stuck_stage': {
        if (!b || b.deathStages.length === 0) {
          hasData = false;
          break;
        }
        sources.add('Gargalos');
        const top = b.deathStages[0];
        summary = `A etapa que mais trava é "${top.stageName}", com ${top.count} oportunidades (${fmtPct(top.pct)}) e ${fmtBRL(top.lostValue)} associados.`;
        b.deathStages.slice(0, 3).forEach((d) =>
          evidence.push({
            label: d.stageName,
            value: `${d.count} deals · ${fmtPct(d.pct)} · ${fmtBRL(d.lostValue)}`,
            tone: 'bad',
          })
        );
        impact = `Receita travada: ${fmtBRL(top.lostValue)}`;
        nextAction = `Revisar critérios de saída da etapa "${top.stageName}".`;
        addLink('Abrir Pipeline', '/app/opportunities');
        addLink('Abrir Gargalos', '/app/revenue-command?tab=gargalos');
        break;
      }
      case 'pipeline_value_stuck': {
        if (!b) {
          hasData = false;
          break;
        }
        sources.add('Gargalos');
        const open = b.revenueRisk.find((x) => x.id === 'pipeline_open');
        if (!open || !open.available) {
          hasData = false;
          break;
        }
        summary = `Valor parado no pipeline aberto: ${fmtBRL(open.value)}.`;
        b.revenueRisk.filter((x) => x.available).forEach((x) =>
          evidence.push({ label: x.label, value: fmtBRL(x.value) })
        );
        impact = fmtBRL(open.value);
        nextAction = 'Filtrar Pipeline por estagnados e revisar próximos passos.';
        addLink('Abrir Pipeline', '/app/opportunities');
        break;
      }
      case 'people_top':
      case 'people_best': {
        if (!pe || pe.topPerformers.length === 0) {
          hasData = false;
          break;
        }
        sources.add('Pessoas');
        const top = pe.topPerformers.slice(0, 3);
        summary = `Quem está carregando a operação: ${top.map((x) => x.name).join(', ')}.`;
        top.forEach((x) =>
          evidence.push({ label: `${x.name} (${x.role})`, value: x.contribution, tone: 'good' })
        );
        impact = pe.scoreboard.topPerformer
          ? `Top performer responde por ${fmtBRL(pe.scoreboard.topPerformer.value)}`
          : null;
        nextAction = 'Replicar boas práticas do topo nos demais vendedores.';
        addLink('Abrir Desempenho', '/app/objetivos/desempenho');
        break;
      }
      case 'people_help':
      case 'people_risk': {
        if (!pe || pe.needsHelp.length === 0) {
          hasData = false;
          break;
        }
        sources.add('Pessoas');
        const help = pe.needsHelp.slice(0, 4);
        summary = `Precisam de ajuda: ${help.map((x) => x.name).join(', ')}.`;
        help.forEach((x) =>
          evidence.push({ label: `${x.name} (${x.role})`, value: x.problem, tone: 'bad' })
        );
        impact = `${pe.needsHelp.length} pessoas com sinais de risco`;
        nextAction = 'Agendar coaching 1:1 com os apontados.';
        addLink('Abrir Desempenho', '/app/objetivos/desempenho');
        addLink('Abrir Pessoas', '/app/revenue-command?tab=pessoas');
        break;
      }
      case 'winloss_reason': {
        if (!b || b.lossReasons.length === 0) {
          hasData = false;
          break;
        }
        sources.add('Win/Loss');
        sources.add('Gargalos');
        const top = b.lossReasons[0];
        summary = `Principal motivo de perda: "${top.reason}" (${top.count} deals, ${fmtPct(top.pct)}, ${fmtBRL(top.lostValue)}).`;
        b.lossReasons.slice(0, 3).forEach((l) =>
          evidence.push({
            label: l.reason,
            value: `${l.count} · ${fmtPct(l.pct)} · ${fmtBRL(l.lostValue)}`,
            tone: 'bad',
          })
        );
        impact = `Total perdido (top 3): ${fmtBRL(b.lossReasons.slice(0, 3).reduce((s, x) => s + x.lostValue, 0))}`;
        nextAction = `Revisar playbook para "${top.reason}".`;
        addLink('Abrir Win/Loss', '/app/intelligence/win-loss');
        break;
      }
      case 'winloss_lost_value': {
        if (!b) {
          hasData = false;
          break;
        }
        sources.add('Win/Loss');
        const total = b.lossReasons.reduce((s, x) => s + x.lostValue, 0);
        if (total <= 0) {
          hasData = false;
          break;
        }
        summary = `Dinheiro perdido no período: ${fmtBRL(total)} distribuído em ${b.lossReasons.length} motivos.`;
        b.lossReasons.slice(0, 5).forEach((l) =>
          evidence.push({ label: l.reason, value: fmtBRL(l.lostValue), tone: 'bad' })
        );
        impact = fmtBRL(total);
        nextAction = 'Abrir Win/Loss para investigar causas dominantes.';
        addLink('Abrir Win/Loss', '/app/intelligence/win-loss');
        break;
      }
      case 'quality_sqls': {
        if (!b) {
          hasData = false;
          break;
        }
        sources.add('Gargalos');
        const leak = b.funnelLeaks.find((x) => x.id === 'sqls_without_proposal');
        if (!leak || !leak.available) {
          hasData = false;
          break;
        }
        summary = `Existem ${leak.count} SQLs sem proposta${leak.value != null ? ` (${fmtBRL(leak.value)} em risco)` : ''}.`;
        evidence.push({ label: leak.label, value: `${leak.count} deals`, tone: 'bad' });
        if (leak.value != null) evidence.push({ label: 'Valor associado', value: fmtBRL(leak.value) });
        impact = leak.value != null ? fmtBRL(leak.value) : `${leak.count} SQLs`;
        nextAction = 'Forçar geração de proposta nos SQLs maduros.';
        addLink('Abrir Qualidade', '/app/objetivos/desempenho?tab=qualidade');
        addLink('Abrir Pipeline', '/app/opportunities');
        break;
      }
      case 'quality_sdr_risk': {
        if (!pe) {
          hasData = false;
          break;
        }
        sources.add('Pessoas');
        const sdrAtRisk = pe.sdrSnapshot
          .filter((s) => s.classification === 'risk' || s.classification === 'attention' || s.classification === 'volume_no_quality')
          .slice(0, 3);
        if (sdrAtRisk.length === 0) {
          hasData = false;
          break;
        }
        summary = `SDRs com maior risco de qualificação: ${sdrAtRisk.map((s) => s.name).join(', ')}.`;
        sdrAtRisk.forEach((s) =>
          evidence.push({
            label: s.name,
            value: `${s.qualified ?? 0} SQLs · SQL→Proposta ${fmtPct(s.sqlToProposalPct)} · ${s.classificationLabel}`,
            tone: 'bad',
          })
        );
        impact = `${sdrAtRisk.length} SDR(s) em alerta`;
        nextAction = 'Coaching focado em qualificação.';
        addLink('Abrir Desempenho SDR', '/app/objetivos/desempenho?tab=sdr');
        break;
      }
      case 'trust_score': {
        if (!h || h.trustScore == null) {
          hasData = false;
          break;
        }
        sources.add('Health & Trust');
        summary = `CRM Trust Score: ${h.trustScore}/100 (${h.trustLabel}). ${h.trustSummary}`;
        evidence.push({ label: 'Integridade', value: `${h.breakdown.integrity}/20` });
        evidence.push({ label: 'Cobertura', value: `${h.breakdown.coverage}/20` });
        evidence.push({ label: 'Frescor', value: `${h.breakdown.freshness}/20` });
        evidence.push({ label: 'Higiene', value: `${h.breakdown.hygiene}/20` });
        evidence.push({ label: 'Consistência', value: `${h.breakdown.consistency}/20` });
        if (h.financialImpact.total > 0) {
          impact = `Receita afetada por gaps de dado: ${fmtBRL(h.financialImpact.total)}`;
        }
        nextAction = h.actions[0]?.title ?? 'Revisar Health & Trust.';
        addLink('Abrir Health & Trust', '/app/revenue-command?tab=health-trust');
        break;
      }
      case 'trust_failing': {
        if (!h) {
          hasData = false;
          break;
        }
        sources.add('Health & Trust');
        const failing = h.sources.filter((s) => s.status === 'failed' || s.status === 'unavailable' || s.status === 'partial');
        if (failing.length === 0) {
          summary = 'Todas as fontes do Revenue Command estão saudáveis.';
          impact = null;
          nextAction = null;
        } else {
          summary = `${failing.length} fonte(s) com problema.`;
          failing.forEach((s) =>
            evidence.push({ label: s.label, value: s.status, tone: 'bad' })
          );
          impact = h.financialImpact.total > 0 ? fmtBRL(h.financialImpact.total) : null;
          nextAction = 'Revisar fontes em Health & Trust.';
        }
        addLink('Abrir Health & Trust', '/app/revenue-command?tab=health-trust');
        break;
      }
      case 'action_today':
      case 'action_most_important': {
        if (!na || na.actions.length === 0) {
          hasData = false;
          break;
        }
        sources.add('Próximas Ações');
        const top = na.actions[0];
        const list = na.actions.slice(0, 3);
        summary =
          intent === 'action_most_important'
            ? `Ação mais importante: ${top.title} (${top.priority}).`
            : `Top ${list.length} ações de hoje:`;
        list.forEach((a) =>
          evidence.push({
            label: a.title,
            value: a.reason ?? a.impactLabel ?? a.priority,
            tone: a.priority === 'critical' || a.priority === 'high' ? 'bad' : 'neutral',
          })
        );
        impact = na.summary?.estimatedImpact ? fmtBRL(na.summary.estimatedImpact) : null;
        nextAction = top.title;
        addLink('Abrir Próximas Ações', '/app/revenue-command?tab=proximas-acoes');
        if (top.primaryCta?.href) addLink(top.primaryCta.label ?? 'Abrir', top.primaryCta.href);
        break;
      }
      default: {
        hasData = false;
        summary = NO_DATA_MSG;
        nextAction =
          'Tente reformular usando termos como "meta", "pipeline", "perda", "forecast", "pessoas", "confiar" ou "fazer hoje".';
        break;
      }
    }

    if (!hasData) {
      summary = summary || NO_DATA_MSG;
    }

    // Confiança a partir de fontes parciais/falhas
    const partialFlags = [
      today.data?.meta.partial,
      risks.data?.meta.partial,
      bottlenecks.data?.meta.partial,
      health.data ? health.data.meta.failedSources > 0 : false,
    ];
    const anyFailed = partialFlags.some((x) => x === true);
    const confidence: CopilotConfidence = !hasData ? 'low' : anyFailed ? 'medium' : 'high';

    return {
      intent,
      summary,
      evidence,
      impact,
      nextAction,
      links,
      sources: Array.from(sources),
      confidence,
      hasData,
    };
  }, [submitted, isLoading, today.data, risks.data, pipeline.data, bottlenecks.data, people.data, nextActions.data, health.data]);

  return {
    question,
    setQuestion,
    ask,
    reset,
    submitted,
    isLoading,
    answer,
  };
}
