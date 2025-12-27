import { Opportunity } from './types';
import { ForecastData, ForecastScenario, RevenueProjection } from './types';
import { parseDateOnly } from '@/lib/dateUtils';

/**
 * Filtra oportunidades apenas de pipelines de vendas (não qualificação)
 * IMPORTANTE: O forecast de receita deve considerar apenas pipelines tipo 'sales'
 */
export function filterSalesPipelineOpportunities(
  opportunities: Opportunity[], 
  salesPipelineIds: string[]
): Opportunity[] {
  if (!salesPipelineIds || salesPipelineIds.length === 0) {
    return opportunities;
  }
  return opportunities.filter(opp => 
    opp.pipeline_id && salesPipelineIds.includes(opp.pipeline_id)
  );
}

/**
 * Calcula o weighted pipeline (soma de valor × probabilidade)
 */
export function calculateWeightedPipeline(opportunities: Opportunity[]): number {
  return opportunities.reduce((sum, opp) => {
    const value = opp.valor_previsto || 0;
    const prob = (opp.prob || 0) / 100;
    return sum + (value * prob);
  }, 0);
}

/**
 * Calcula o pipeline coverage (% do pipeline em relação à meta)
 */
export function calculatePipelineCoverage(pipelineTotal: number, goal: number): number {
  if (goal === 0) return 0;
  return (pipelineTotal / goal) * 100;
}

/**
 * Calcula o expected value de uma oportunidade específica
 */
export function calculateExpectedValue(opportunity: Opportunity): number {
  const value = opportunity.valor_previsto || 0;
  const prob = (opportunity.prob || 0) / 100;
  return value * prob;
}

/**
 * Filtra oportunidades com data de fechamento no mês atual
 */
export function getOpportunitiesClosingThisMonth(opportunities: Opportunity[]): Opportunity[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  return opportunities.filter(opp => {
    if (!opp.close_date_prevista) return false;
    const closeDate = parseDateOnly(opp.close_date_prevista);
    return closeDate.getMonth() === currentMonth && closeDate.getFullYear() === currentYear;
  });
}

/**
 * Calcula os dias restantes no mês atual
 */
export function getDaysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

/**
 * Interface de oportunidade para cálculo de cenários
 */
export interface ForecastOpportunityInput {
  id: string;
  valor_previsto?: number | null;
  prob?: number | null;
  stage_probability?: number | null; // Probabilidade padrão do estágio
  nrhs_score?: number | null; // NRHS score for eligibility
  nrhs_weight_factor?: number; // Pre-calculated weight factor
  forecast_eligibility?: 'full' | 'partial' | 'low_confidence' | 'excluded';
}

/**
 * FUNÇÃO CENTRALIZADA DE CENÁRIOS DE FORECAST
 * 
 * Fórmulas baseadas em melhores práticas de mercado com diferenciação REAL:
 * 
 * - Pessimista: closed + deals elegíveis com prob ≥80% (alta confiança)
 * - Realista: closed + weighted pipeline ajustado por NRHS (Σ valor × prob/100 × nrhs_weight)
 * - Otimista: closed + weighted × 1.2 (20% boost para garantir > realista)
 * - Melhor Caso: closed + todo o pipeline elegível
 * 
 * IMPORTANTE: Usa stage_probability como fallback quando prob não está definida
 * GARANTIA: Pessimista ≤ Realista ≤ Otimista ≤ Melhor Caso (progressão real)
 * 
 * NRHS INTEGRATION:
 * - Deals com NRHS < 40 são EXCLUÍDOS de todos os cenários (exceto pipeline informativo)
 * - Peso NRHS aplicado: ≥75 = 1.0, 60-74 = 0.7, 40-59 = 0.4, <40 = 0.0
 */
export interface ForecastScenariosInput {
  opportunities: ForecastOpportunityInput[];
  closedRevenue: number;
  goal: number;
}

export interface ForecastScenarioWithDeals extends ForecastScenario {
  dealIds: string[];
  dealCount: number;
  nrhsAverage?: number;
  excludedCount?: number;
  excludedValue?: number;
}

export function calculateForecastScenarios(input: ForecastScenariosInput): ForecastScenarioWithDeals[] {
  const { opportunities, closedRevenue, goal } = input;
  
  // Função para obter probabilidade efetiva (prob do deal > prob do estágio > 0)
  const getEffectiveProb = (o: ForecastOpportunityInput): number => {
    if (o.prob !== null && o.prob !== undefined && o.prob > 0) {
      return o.prob;
    }
    if (o.stage_probability !== null && o.stage_probability !== undefined && o.stage_probability > 0) {
      return o.stage_probability;
    }
    return 0;
  };

  // Função para obter peso NRHS
  const getNRHSWeight = (o: ForecastOpportunityInput): number => {
    if (o.nrhs_weight_factor !== undefined) return o.nrhs_weight_factor;
    const score = o.nrhs_score;
    if (score === null || score === undefined) return 0.7;
    if (score >= 75) return 1.0;
    if (score >= 60) return 0.7;
    if (score >= 40) return 0.4;
    return 0.0;
  };

  // Check if deal is eligible (NRHS >= 40 or no score)
  const isEligible = (o: ForecastOpportunityInput): boolean => {
    if (o.forecast_eligibility === 'excluded') return false;
    const score = o.nrhs_score;
    return score === null || score === undefined || score >= 40;
  };

  // Filter eligible deals (NRHS >= 40)
  const eligibleOpportunities = opportunities.filter(isEligible);
  
  // Track excluded deals
  const excludedOpportunities = opportunities.filter(o => !isEligible(o));
  const excludedCount = excludedOpportunities.length;
  const excludedValue = excludedOpportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);

  // Calculate NRHS average for eligible deals
  const eligibleWithNRHS = eligibleOpportunities.filter(o => o.nrhs_score !== null && o.nrhs_score !== undefined);
  const nrhsAverage = eligibleWithNRHS.length > 0
    ? eligibleWithNRHS.reduce((sum, o) => sum + (o.nrhs_score || 0), 0) / eligibleWithNRHS.length
    : 0;

  // Pessimista: deals elegíveis com probabilidade efetiva ≥80% (alta certeza)
  const pessimisticDeals = eligibleOpportunities.filter(o => getEffectiveProb(o) >= 80);
  const pessimisticPipeline = pessimisticDeals.reduce((sum, o) => {
    const weight = getNRHSWeight(o);
    return sum + (o.valor_previsto || 0) * weight;
  }, 0);

  // Realista: weighted pipeline com peso NRHS (valor × probabilidade × nrhs_weight)
  const realisticPipeline = eligibleOpportunities.reduce((sum, o) => {
    const prob = getEffectiveProb(o);
    const weight = getNRHSWeight(o);
    return sum + ((o.valor_previsto || 0) * prob / 100 * weight);
  }, 0);
  const realisticDeals = eligibleOpportunities.filter(o => getEffectiveProb(o) > 0);

  // Otimista: weighted pipeline × 1.2 (20% boost para garantir diferenciação)
  const optimisticPipeline = realisticPipeline * 1.2;
  const optimisticDeals = eligibleOpportunities.filter(o => getEffectiveProb(o) >= 30);

  // Melhor Caso: todo o pipeline elegível com peso NRHS
  const bestCasePipeline = eligibleOpportunities.reduce((sum, o) => {
    const weight = getNRHSWeight(o);
    return sum + (o.valor_previsto || 0) * weight;
  }, 0);
  const bestCaseDeals = eligibleOpportunities;

  // Valores com receita fechada
  const pessimistic = closedRevenue + pessimisticPipeline;
  const realistic = closedRevenue + realisticPipeline;
  const optimistic = closedRevenue + optimisticPipeline;
  const bestCase = closedRevenue + bestCasePipeline;

  // GARANTIA DE PROGRESSÃO REAL
  const finalPessimistic = pessimistic;
  const finalRealistic = Math.max(realistic, finalPessimistic);
  const finalOptimistic = Math.max(optimistic, finalRealistic);
  const finalBestCase = Math.max(bestCase, finalOptimistic);

  return [
    {
      name: 'pessimista',
      label: 'Pessimista',
      value: finalPessimistic,
      probability: 90,
      meetsGoal: finalPessimistic >= goal,
      gap: goal - finalPessimistic,
      percentage: goal > 0 ? (finalPessimistic / goal) * 100 : 0,
      dealIds: pessimisticDeals.map(d => d.id),
      dealCount: pessimisticDeals.length,
      nrhsAverage,
      excludedCount,
      excludedValue,
    },
    {
      name: 'realista',
      label: 'Realista',
      value: finalRealistic,
      probability: 60,
      meetsGoal: finalRealistic >= goal,
      gap: goal - finalRealistic,
      percentage: goal > 0 ? (finalRealistic / goal) * 100 : 0,
      dealIds: realisticDeals.map(d => d.id),
      dealCount: realisticDeals.length,
      nrhsAverage,
      excludedCount,
      excludedValue,
    },
    {
      name: 'otimista',
      label: 'Otimista',
      value: finalOptimistic,
      probability: 40,
      meetsGoal: finalOptimistic >= goal,
      gap: goal - finalOptimistic,
      percentage: goal > 0 ? (finalOptimistic / goal) * 100 : 0,
      dealIds: optimisticDeals.map(d => d.id),
      dealCount: optimisticDeals.length,
      nrhsAverage,
      excludedCount,
      excludedValue,
    },
    {
      name: 'best_case',
      label: 'Melhor Caso',
      value: finalBestCase,
      probability: 20,
      meetsGoal: finalBestCase >= goal,
      gap: goal - finalBestCase,
      percentage: goal > 0 ? (finalBestCase / goal) * 100 : 0,
      dealIds: bestCaseDeals.map(d => d.id),
      dealCount: bestCaseDeals.length,
      nrhsAverage,
      excludedCount,
      excludedValue,
    },
  ];
}

/**
 * @deprecated Use calculateForecastScenarios instead
 */
export function generateScenarios(opportunities: Opportunity[], goal: number): ForecastScenarioWithDeals[] {
  return calculateForecastScenarios({
    opportunities: opportunities.map(o => ({ 
      id: o.id || '', 
      valor_previsto: o.valor_previsto, 
      prob: o.prob 
    })),
    closedRevenue: 0,
    goal,
  });
}

/**
 * Gera projeções diárias até o fim do mês
 */
export function generateProjections(
  closedRevenue: number,
  opportunities: Opportunity[],
  goal: number,
  daysLeft: number
): RevenueProjection[] {
  const projections: RevenueProjection[] = [];
  const now = new Date();
  const currentDay = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  const dailyVelocity = daysLeft > 0 ? (goal - closedRevenue) / daysLeft : 0;
  const weightedPipeline = calculateWeightedPipeline(opportunities);
  const weightedDailyVelocity = daysLeft > 0 ? weightedPipeline / daysLeft : 0;
  
  for (let day = currentDay; day <= lastDay; day++) {
    const daysFromNow = day - currentDay;
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    
    projections.push({
      date: date.toISOString().split('T')[0],
      closed: closedRevenue,
      projected: closedRevenue + (dailyVelocity * daysFromNow),
      weightedProjected: closedRevenue + (weightedDailyVelocity * daysFromNow),
      goal: goal,
    });
  }
  
  return projections;
}

/**
 * Calcula todas as métricas de forecast
 */
export function calculateForecastData(
  opportunities: Opportunity[], 
  goal: number = 100000,
  closedRevenue: number = 0
): ForecastData {
  const pipelineTotal = opportunities.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);
  const weightedPipeline = calculateWeightedPipeline(opportunities);
  const pipelineCoverage = calculatePipelineCoverage(pipelineTotal, goal);
  
  const closingThisMonth = getOpportunitiesClosingThisMonth(opportunities);
  const expectedCloseThisMonth = calculateWeightedPipeline(closingThisMonth);
  
  const daysLeft = getDaysLeftInMonth();
  const velocityPerDay = daysLeft > 0 ? weightedPipeline / daysLeft : 0;
  
  const scenarios = generateScenarios(opportunities, goal);
  const projections = generateProjections(closedRevenue, opportunities, goal, daysLeft);
  
  return {
    pipelineTotal,
    weightedPipeline,
    pipelineCoverage,
    expectedCloseThisMonth,
    scenarios,
    projections,
    daysLeft,
    velocityPerDay,
    goal,
    closedRevenue,
  };
}
