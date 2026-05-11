import type { WinLossDeal, WinLossDataResult } from '@/hooks/useWinLossData';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface CategoryAggregate {
  category: string;
  label: string;
  count: number;
  pct: number; // % das perdas (count)
  lostValue: number;
  trendPp: number | null; // delta em pp vs período anterior (mesma janela)
  recommendation: string;
}

export const RECOMMENDATIONS: Record<string, string> = {
  timing: 'Ativar alerta automático para oportunidades paradas acima de 7 dias e playbook de retomada por urgência.',
  competition: 'Revisar diferenciais vs concorrentes ranqueados em "Perdas por Concorrente" e atualizar battlecards.',
  price: 'Revisar política comercial e faixas de desconto aprovadas para mitigar objeções de valor.',
  no_fit: 'Refinar ICP e qualificação no topo do funil para evitar deals fora do perfil.',
  operational: 'Acionar CS/Operações para reduzir atritos pós-venda relatados pelo cliente.',
  internal: 'Auditar erros internos recentes e criar checklist de pré-envio de propostas.',
  sales_process: 'Reforçar treinamento de processo comercial e cadência de follow-up.',
  other: 'Aprofundar entrevistas de perda para mapear motivos atualmente não classificados.',
};

export function getCategoryLabel(category: string): string {
  return LOSS_CATEGORY_LABELS[category] || category;
}

export function getRecommendation(category: string): string {
  return RECOMMENDATIONS[category] || RECOMMENDATIONS.other;
}

/**
 * Agrega losses por categoria canônica (loss_reason.category),
 * com valor perdido e tendência vs período anterior de mesma duração.
 */
export function aggregateLossesByCategory(losses: WinLossDeal[], dateRange?: { from: Date; to: Date }): CategoryAggregate[] {
  const totalCount = losses.length;
  if (totalCount === 0) return [];

  // Janela atual = (from, to). Janela anterior = mesma duração imediatamente antes de from.
  let prevCounts: Record<string, number> = {};
  let prevTotal = 0;
  if (dateRange) {
    const durationMs = dateRange.to.getTime() - dateRange.from.getTime();
    const prevFrom = new Date(dateRange.from.getTime() - durationMs);
    const prevTo = dateRange.from;
    for (const l of losses) {
      const closedAt = (l.opportunity?.closed_at || l.opportunity?.updated_at) as string | undefined;
      if (!closedAt) continue;
      const t = new Date(closedAt).getTime();
      if (t >= prevFrom.getTime() && t < prevTo.getTime()) {
        const cat = (l.reason as any)?.category || 'other';
        prevCounts[cat] = (prevCounts[cat] || 0) + 1;
        prevTotal++;
      }
    }
  }

  const map = new Map<string, { count: number; lostValue: number }>();
  for (const l of losses) {
    const cat = (l.reason as any)?.category || 'other';
    const entry = map.get(cat) || { count: 0, lostValue: 0 };
    entry.count++;
    entry.lostValue += Number(l.final_value) || 0;
    map.set(cat, entry);
  }

  const result: CategoryAggregate[] = [];
  for (const [cat, agg] of map.entries()) {
    const pct = Math.round((agg.count / totalCount) * 100);
    let trendPp: number | null = null;
    if (dateRange && prevTotal > 0) {
      const prevPct = Math.round(((prevCounts[cat] || 0) / prevTotal) * 100);
      trendPp = pct - prevPct;
    }
    result.push({
      category: cat,
      label: getCategoryLabel(cat),
      count: agg.count,
      pct,
      lostValue: agg.lostValue,
      trendPp,
      recommendation: getRecommendation(cat),
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export function calcSeverity(lostValue: number, wonValue: number, topShare: number): Severity {
  const total = lostValue + wonValue;
  const lostShare = total > 0 ? lostValue / total : 0;
  // topShare: 0..1 (participação do top motivo nas perdas)
  const score = lostShare * 0.6 + topShare * 0.4;
  if (score >= 0.6) return 'critical';
  if (score >= 0.4) return 'high';
  if (score >= 0.2) return 'medium';
  return 'low';
}

export interface ExecutiveDiagnosis {
  topCategory: string;
  topLabel: string;
  topLostValue: number;
  topShare: number; // 0..1
  cycleDelta: number | null; // dias (lost - won)
  recommendation: string;
  severity: Severity;
  copy: string;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export function buildExecutiveDiagnosis(data: WinLossDataResult, dateRange?: { from: Date; to: Date }): ExecutiveDiagnosis | null {
  if (!data || data.losses.length === 0) return null;
  const aggregates = aggregateLossesByCategory(data.losses, dateRange);
  if (aggregates.length === 0) return null;
  const top = aggregates[0];
  const topShare = data.losses.length > 0 ? top.count / data.losses.length : 0;
  const cycleDelta =
    data.avgCycleLost != null && data.avgCycleWon != null ? data.avgCycleLost - data.avgCycleWon : null;
  const severity = calcSeverity(data.lostValue, data.wonValue, topShare);

  const cyclePart =
    cycleDelta != null && cycleDelta > 0
      ? `Os deals perdidos levam ${cycleDelta} dias a mais que os ganhos e `
      : '';
  const copy = `No período analisado, o principal vazamento de receita está em ${top.label}. ${cyclePart}concentram ${fmtBRL(top.lostValue)} em receita não capturada. Recomendação: ${top.recommendation.toLowerCase()}`;

  return {
    topCategory: top.category,
    topLabel: top.label,
    topLostValue: top.lostValue,
    topShare,
    cycleDelta,
    recommendation: top.recommendation,
    severity,
    copy,
  };
}

export interface MonthSignal {
  icon: 'competition' | 'shift' | 'rise';
  text: string;
}

export function buildMonthSignals(data: WinLossDataResult, dateRange: { from: Date; to: Date }): MonthSignal[] {
  const signals: MonthSignal[] = [];
  if (!data || data.losses.length === 0) return signals;

  // 1. Concorrência: % das perdas com competitor preenchido.
  const withCompetitor = data.losses.filter((l) => l.competitor && l.competitor.trim()).length;
  const compPct = Math.round((withCompetitor / data.losses.length) * 100);
  if (compPct > 0) {
    signals.push({ icon: 'competition', text: `Concorrência apareceu em ${compPct}% das perdas.` });
  }

  // 2. Categoria que virou principal causa.
  const aggCurrent = aggregateLossesByCategory(data.losses, dateRange);
  if (aggCurrent.length > 0 && aggCurrent[0].trendPp != null && aggCurrent[0].trendPp > 0) {
    signals.push({ icon: 'shift', text: `${aggCurrent[0].label} virou a principal causa de perda.` });
  }

  // 3. Categoria que mais subiu em pp.
  const sortedByRise = [...aggCurrent]
    .filter((a) => a.trendPp != null && a.trendPp > 0 && a.category !== aggCurrent[0]?.category)
    .sort((a, b) => (b.trendPp! - a.trendPp!));
  if (sortedByRise.length > 0) {
    signals.push({ icon: 'rise', text: `${sortedByRise[0].label} subiu ${sortedByRise[0].trendPp}pp versus período anterior.` });
  }

  return signals.slice(0, 3);
}
