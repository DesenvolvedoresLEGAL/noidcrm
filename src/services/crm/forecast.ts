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
    // Se não tiver IDs específicos, assumir todas como vendas (retrocompatibilidade)
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
 * FUNÇÃO CENTRALIZADA DE CENÁRIOS DE FORECAST
 * 
 * Baseada nas melhores práticas de mercado (Salesforce, HubSpot, Gartner):
 * - Pessimista: closed + deals com probabilidade ≥80% (alta confiança)
 * - Realista: closed + weighted pipeline (Σ valor × prob/100)
 * - Otimista: closed + deals com probabilidade ≥40% (inclui mais deals)
 * - Melhor Caso: closed + todo o pipeline (se tudo fechar)
 * 
 * GARANTIA: Pessimista ≤ Realista ≤ Otimista ≤ Melhor Caso
 * Usamos Math.max para garantir valores sempre crescentes
 */
export interface ForecastScenariosInput {
  opportunities: Array<{ valor_previsto?: number | null; prob?: number | null }>;
  closedRevenue: number;
  goal: number;
}

export function calculateForecastScenarios(input: ForecastScenariosInput): ForecastScenario[] {
  const { opportunities, closedRevenue, goal } = input;
  
  // Pessimista: deals com probabilidade ≥80% (alta certeza)
  const pessimisticPipeline = opportunities
    .filter(o => (o.prob || 0) >= 80)
    .reduce((sum, o) => sum + (o.valor_previsto || 0), 0);

  // Realista: weighted pipeline (valor × probabilidade)
  const realisticPipeline = opportunities
    .reduce((sum, o) => sum + ((o.valor_previsto || 0) * (o.prob || 0) / 100), 0);

  // Otimista: deals com probabilidade ≥40%
  const optimisticPipeline = opportunities
    .filter(o => (o.prob || 0) >= 40)
    .reduce((sum, o) => sum + (o.valor_previsto || 0), 0);

  // Melhor Caso: todo o pipeline
  const bestCasePipeline = opportunities
    .reduce((sum, o) => sum + (o.valor_previsto || 0), 0);

  // Valores com receita fechada
  const pessimistic = closedRevenue + pessimisticPipeline;
  const realistic = closedRevenue + realisticPipeline;
  const optimistic = closedRevenue + optimisticPipeline;
  const bestCase = closedRevenue + bestCasePipeline;

  // GARANTIA DE VALORES CRESCENTES usando Math.max
  const finalPessimistic = pessimistic;
  const finalRealistic = Math.max(realistic, finalPessimistic);
  const finalOptimistic = Math.max(optimistic, finalRealistic);
  const finalBestCase = Math.max(bestCase, finalOptimistic);

  return [
    {
      name: 'pessimista',
      label: 'Pessimista',
      value: finalPessimistic,
      probability: 90, // Alta certeza de atingir
      meetsGoal: finalPessimistic >= goal,
      gap: goal - finalPessimistic,
      percentage: goal > 0 ? (finalPessimistic / goal) * 100 : 0,
    },
    {
      name: 'realista',
      label: 'Realista',
      value: finalRealistic,
      probability: 60, // Probabilidade média
      meetsGoal: finalRealistic >= goal,
      gap: goal - finalRealistic,
      percentage: goal > 0 ? (finalRealistic / goal) * 100 : 0,
    },
    {
      name: 'otimista',
      label: 'Otimista',
      value: finalOptimistic,
      probability: 40, // Requer bom desempenho
      meetsGoal: finalOptimistic >= goal,
      gap: goal - finalOptimistic,
      percentage: goal > 0 ? (finalOptimistic / goal) * 100 : 0,
    },
    {
      name: 'best_case',
      label: 'Melhor Caso',
      value: finalBestCase,
      probability: 20, // Cenário ideal
      meetsGoal: finalBestCase >= goal,
      gap: goal - finalBestCase,
      percentage: goal > 0 ? (finalBestCase / goal) * 100 : 0,
    },
  ];
}

/**
 * @deprecated Use calculateForecastScenarios instead
 * Mantido para retrocompatibilidade
 */
export function generateScenarios(opportunities: Opportunity[], goal: number): ForecastScenario[] {
  return calculateForecastScenarios({
    opportunities: opportunities.map(o => ({ valor_previsto: o.valor_previsto, prob: o.prob })),
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
  
  // Velocidade linear simples
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
 * @param opportunities - Oportunidades abertas do pipeline
 * @param goal - Meta de receita do mês
 * @param closedRevenue - Receita real já fechada (soma de valor_previsto das oportunidades won no mês)
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
