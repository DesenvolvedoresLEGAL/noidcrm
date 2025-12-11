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
 * Gera cenários de forecast baseado nas oportunidades
 */
export function generateScenarios(opportunities: Opportunity[], goal: number): ForecastScenario[] {
  const pipelineTotal = opportunities.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);
  const weightedPipeline = calculateWeightedPipeline(opportunities);
  
  // Pessimista: apenas oportunidades com 75%+
  const pessimista = opportunities
    .filter(opp => (opp.prob || 0) >= 75)
    .reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);
  
  // Realista: weighted pipeline
  const realista = weightedPipeline;
  
  // Otimista: oportunidades com 50%+
  const otimista = opportunities
    .filter(opp => (opp.prob || 0) >= 50)
    .reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);
  
  // Best case: pipeline total
  const bestCase = pipelineTotal;
  
  return [
    {
      name: 'pessimista',
      label: 'Pessimista',
      value: pessimista,
      probability: 25,
      meetsGoal: pessimista >= goal,
      gap: goal - pessimista,
      percentage: goal > 0 ? (pessimista / goal) * 100 : 0,
    },
    {
      name: 'realista',
      label: 'Realista',
      value: realista,
      probability: 50,
      meetsGoal: realista >= goal,
      gap: goal - realista,
      percentage: goal > 0 ? (realista / goal) * 100 : 0,
    },
    {
      name: 'otimista',
      label: 'Otimista',
      value: otimista,
      probability: 75,
      meetsGoal: otimista >= goal,
      gap: goal - otimista,
      percentage: goal > 0 ? (otimista / goal) * 100 : 0,
    },
    {
      name: 'best_case',
      label: 'Best Case',
      value: bestCase,
      probability: 90,
      meetsGoal: bestCase >= goal,
      gap: goal - bestCase,
      percentage: goal > 0 ? (bestCase / goal) * 100 : 0,
    },
  ];
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
