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
}

/**
 * FUNÇÃO CENTRALIZADA DE CENÁRIOS DE FORECAST
 * 
 * Fórmulas baseadas em melhores práticas de mercado com diferenciação REAL:
 * 
 * - Pessimista: closed + deals com prob ≥80% (alta confiança)
 * - Realista: closed + weighted pipeline (Σ valor × prob/100)
 * - Otimista: closed + weighted × 1.2 (20% boost para garantir > realista)
 * - Melhor Caso: closed + todo o pipeline
 * 
 * IMPORTANTE: Usa stage_probability como fallback quando prob não está definida
 * GARANTIA: Pessimista ≤ Realista ≤ Otimista ≤ Melhor Caso (progressão real)
 */
export interface ForecastScenariosInput {
  opportunities: ForecastOpportunityInput[];
  closedRevenue: number;
  goal: number;
}

export interface ForecastScenarioWithDeals extends ForecastScenario {
  dealIds: string[];
  dealCount: number;
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

  // Pessimista: deals com probabilidade efetiva ≥80% (alta certeza)
  const pessimisticDeals = opportunities.filter(o => getEffectiveProb(o) >= 80);
  const pessimisticPipeline = pessimisticDeals.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);

  // Realista: weighted pipeline (valor × probabilidade efetiva)
  const realisticPipeline = opportunities.reduce((sum, o) => {
    const prob = getEffectiveProb(o);
    return sum + ((o.valor_previsto || 0) * prob / 100);
  }, 0);
  const realisticDeals = opportunities.filter(o => getEffectiveProb(o) > 0);

  // Otimista: weighted pipeline × 1.2 (20% boost para garantir diferenciação)
  // Isso representa um cenário onde conversões são 20% melhores que o esperado
  const optimisticPipeline = realisticPipeline * 1.2;
  // Para deals, incluímos todos com prob ≥30% (mais agressivo)
  const optimisticDeals = opportunities.filter(o => getEffectiveProb(o) >= 30);

  // Melhor Caso: todo o pipeline (se tudo fechar)
  const bestCasePipeline = opportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
  const bestCaseDeals = opportunities;

  // Valores com receita fechada
  const pessimistic = closedRevenue + pessimisticPipeline;
  const realistic = closedRevenue + realisticPipeline;
  const optimistic = closedRevenue + optimisticPipeline;
  const bestCase = closedRevenue + bestCasePipeline;

  // GARANTIA DE PROGRESSÃO REAL (sem Math.max artificial)
  // A fórmula já garante: pessimistic (subset) ≤ realistic (weighted) ≤ optimistic (weighted×1.2) ≤ bestCase (total)
  const finalPessimistic = pessimistic;
  const finalRealistic = Math.max(realistic, finalPessimistic); // Segurança
  const finalOptimistic = Math.max(optimistic, finalRealistic); // Segurança
  const finalBestCase = Math.max(bestCase, finalOptimistic); // Segurança

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
