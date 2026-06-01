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

/** Ações curtas e diretas para o cockpit executivo (Sprint WL-UI-02). */
export const SHORT_RECOMMENDATIONS: Record<string, string> = {
  timing: 'Ativar alerta automático após 7 dias sem interação.',
  competition: 'Atualizar battlecards dos concorrentes recorrentes.',
  price: 'Revisar política de desconto e faixas aprovadas.',
  no_fit: 'Refinar ICP e qualificação no topo do funil.',
  operational: 'Acionar CS para reduzir atritos pós-venda.',
  internal: 'Criar checklist de pré-envio de propostas.',
  sales_process: 'Reforçar cadência e SLA de follow-up.',
  other: 'Aprofundar entrevistas de perda.',
};

/**
 * Categorias consideradas falha comercial/processual (mapeamento local frontend).
 * Não altera taxonomia global no banco.
 */
export const COMMERCIAL_FAILURE_CATEGORIES = new Set([
  'timing',
  'sales_process',
  'internal',
  'operational',
]);

export function getCategoryLabel(category: string): string {
  return LOSS_CATEGORY_LABELS[category] || category;
}

export function getRecommendation(category: string): string {
  return RECOMMENDATIONS[category] || RECOMMENDATIONS.other;
}

export function getShortRecommendation(category: string): string {
  return SHORT_RECOMMENDATIONS[category] || SHORT_RECOMMENDATIONS.other;
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
  topCount: number;
  topLostValue: number;
  topShare: number; // 0..1
  cycleDelta: number | null; // dias (lost - won)
  recommendation: string;
  shortRecommendation: string;
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
  const copy = `No período analisado, o principal vazamento de receita está em ${top.label}. ${cyclePart}concentram ${fmtBRL(top.lostValue)} em receita não capturada.`;

  return {
    topCategory: top.category,
    topLabel: top.label,
    topCount: top.count,
    topLostValue: top.lostValue,
    topShare,
    cycleDelta,
    recommendation: top.recommendation,
    shortRecommendation: getShortRecommendation(top.category),
    severity,
    copy,
  };
}

export interface ImpactEstimate {
  available: boolean;
  winRatePotentialPp: number | null;
  monthlyRevenuePotential: number | null;
  reason?: string;
}

/**
 * Estima impacto de eliminar o principal motivo de perda.
 * Critérios: >= 10 perdas e janela >= 30 dias para considerar significativo.
 */
export function buildImpactEstimate(
  data: WinLossDataResult,
  diagnosis: ExecutiveDiagnosis,
  dateRange?: { from: Date; to: Date },
): ImpactEstimate {
  const wins = data.wins.length;
  const losses = data.losses.length;
  const totalDeals = wins + losses;
  if (totalDeals === 0 || losses < 10) {
    return { available: false, winRatePotentialPp: null, monthlyRevenuePotential: null };
  }
  if (!dateRange) {
    return { available: false, winRatePotentialPp: null, monthlyRevenuePotential: null };
  }
  const days = Math.max(
    1,
    Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86_400_000),
  );
  if (days < 30) {
    return { available: false, winRatePotentialPp: null, monthlyRevenuePotential: null };
  }

  const currentWR = wins / totalDeals;
  const potentialWR = (wins + diagnosis.topCount) / totalDeals;
  const winRatePotentialPp = Math.round((potentialWR - currentWR) * 100);

  const monthlyRevenuePotential = Math.round((diagnosis.topLostValue / days) * 30);

  return {
    available: true,
    winRatePotentialPp,
    monthlyRevenuePotential,
  };
}

export interface CommercialFailureSummary {
  available: boolean;
  totalLostValue: number;
  commercialLostValue: number;
  commercialCount: number;
  pctOfLostValue: number; // 0..100
  topCategory: string | null;
  topCategoryLabel: string | null;
  topAction: string | null;
}

/**
 * Mapeamento local (frontend) — separa perda inevitável de falha comercial/processual.
 * Não altera taxonomia global.
 */
export function buildCommercialFailureSummary(data: WinLossDataResult): CommercialFailureSummary {
  if (!data || data.losses.length === 0) {
    return {
      available: false,
      totalLostValue: 0,
      commercialLostValue: 0,
      commercialCount: 0,
      pctOfLostValue: 0,
      topCategory: null,
      topCategoryLabel: null,
      topAction: null,
    };
  }

  const byCat = new Map<string, { count: number; value: number }>();
  let totalLostValue = 0;
  let commercialLostValue = 0;
  let commercialCount = 0;

  for (const l of data.losses) {
    const cat = ((l.reason as any)?.category as string) || 'other';
    const value = Number(l.final_value) || 0;
    totalLostValue += value;
    if (COMMERCIAL_FAILURE_CATEGORIES.has(cat)) {
      commercialLostValue += value;
      commercialCount++;
      const e = byCat.get(cat) || { count: 0, value: 0 };
      e.count++;
      e.value += value;
      byCat.set(cat, e);
    }
  }

  if (commercialCount === 0) {
    return {
      available: true,
      totalLostValue,
      commercialLostValue: 0,
      commercialCount: 0,
      pctOfLostValue: 0,
      topCategory: null,
      topCategoryLabel: null,
      topAction: null,
    };
  }

  const top = [...byCat.entries()].sort((a, b) => b[1].value - a[1].value)[0];
  const topCat = top?.[0] || null;

  return {
    available: true,
    totalLostValue,
    commercialLostValue,
    commercialCount,
    pctOfLostValue: totalLostValue > 0 ? Math.round((commercialLostValue / totalLostValue) * 100) : 0,
    topCategory: topCat,
    topCategoryLabel: topCat ? getCategoryLabel(topCat) : null,
    topAction: topCat ? getShortRecommendation(topCat) : null,
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
