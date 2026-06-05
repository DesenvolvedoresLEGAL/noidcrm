/**
 * PATCH OTE 1.4.1 — % Meta oficial do modo Sistema OTE Completo.
 *
 * Fórmula única (não negociável):
 *   - Closers (goal_type='revenue'): receita_elegivel_ote / meta
 *   - Pré-vendas (goal_type='leads'): leads_qualificados / meta
 *
 * Jamais usar receita comercial bruta / aprovada / válida / "Comissão elegível
 * comercial". O numerador DEVE ser o mesmo valor exibido nas colunas
 * "Receita elegível OTE" ou "Leads Qualificados" da própria tela, garantindo
 * que progresso, flag, multiplicador (quando recalculado) e Excel
 * representem exatamente o mesmo percentual.
 */
import type { OTEMonthlyResult } from '@/hooks/useOTEData';

export function computeOteAchievementPercentage(params: {
  result: OTEMonthlyResult;
  eligibleRevenue?: number;
  qualifiedLeads?: number;
}): number {
  const { result, eligibleRevenue, qualifiedLeads } = params;
  const goal = Number(result.goal_amount || 0);
  if (goal <= 0) return 0;
  const numerator =
    result.goal_type === 'leads'
      ? Number(qualifiedLeads ?? result.total_sales ?? 0)
      : Number(eligibleRevenue ?? 0);
  if (!Number.isFinite(numerator) || numerator <= 0) return 0;
  return (numerator / goal) * 100;
}

export function computeOteFlagColor(
  pct: number,
  blueThreshold = 70,
  yellowMinThreshold = 50,
): 'blue' | 'yellow' | 'red' {
  if (pct >= blueThreshold) return 'blue';
  if (pct >= yellowMinThreshold) return 'yellow';
  return 'red';
}
