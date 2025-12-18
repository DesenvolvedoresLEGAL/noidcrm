/**
 * Serviço centralizado para cálculo de confiabilidade do forecast.
 * 
 * Este serviço garante que a mesma métrica de confiança seja usada
 * em toda a plataforma, eliminando inconsistências entre dashboards.
 * 
 * Fórmula de confiança:
 * - 40% Completude dos dados (probabilidade, data, valor, atividade recente)
 * - 20% Dados históricos (histórico de vendas disponível)
 * - 20% Saúde do pipeline (baixo risco vs alto risco)
 * - 20% Cobertura da meta (pipeline cobre a meta)
 */

export interface ForecastConfidenceInput {
  // Opportunities metrics
  totalOpportunities: number;
  withProbability: number;
  withCloseDate: number;
  withValue: number;
  withRecentActivity: number;
  lowRiskCount: number;
  
  // Historical data
  monthsWithSalesData: number;
  totalWonOpportunities: number;
  
  // Goal coverage
  pipelineValue: number;
  goal: number;
}

export interface ForecastConfidenceResult {
  score: number;
  label: 'Alta' | 'Moderada' | 'Baixa' | 'Muito Baixa';
  color: string;
  bgColor: string;
  factors: {
    dataCompleteness: number;
    historicalData: number;
    pipelineHealth: number;
    goalCoverage: number;
  };
  methodology: string;
}

/**
 * Calcula a confiabilidade do forecast usando fórmula padronizada.
 * Esta função DEVE ser usada em todos os dashboards que exibem
 * a métrica de confiança do forecast.
 */
export function calculateForecastConfidence(input: ForecastConfidenceInput): ForecastConfidenceResult {
  const {
    totalOpportunities,
    withProbability,
    withCloseDate,
    withValue,
    withRecentActivity,
    lowRiskCount,
    monthsWithSalesData,
    totalWonOpportunities,
    pipelineValue,
    goal
  } = input;

  // Fator 1: Completude dos dados (40%)
  // Média das 4 métricas de completude
  const probPercent = totalOpportunities > 0 ? (withProbability / totalOpportunities) * 100 : 0;
  const datePercent = totalOpportunities > 0 ? (withCloseDate / totalOpportunities) * 100 : 0;
  const valuePercent = totalOpportunities > 0 ? (withValue / totalOpportunities) * 100 : 0;
  const activityPercent = totalOpportunities > 0 ? (withRecentActivity / totalOpportunities) * 100 : 0;
  
  const dataCompleteness = (probPercent + datePercent + valuePercent + activityPercent) / 4 / 100;

  // Fator 2: Dados históricos (20%)
  // Baseado em meses com dados e oportunidades ganhas
  const monthsScore = Math.min(monthsWithSalesData / 12, 1); // Max 1 ano
  const wonScore = Math.min(totalWonOpportunities / 10, 1); // Max 10 deals
  const historicalData = (monthsScore * 0.6) + (wonScore * 0.4);

  // Fator 3: Saúde do pipeline (20%)
  // Proporção de oportunidades de baixo/médio risco
  const pipelineHealth = totalOpportunities > 0 
    ? lowRiskCount / totalOpportunities 
    : 0;

  // Fator 4: Cobertura da meta (20%)
  // O pipeline consegue cobrir a meta?
  const goalCoverage = goal > 0 && pipelineValue > 0 
    ? Math.min(pipelineValue / goal, 1) 
    : 0;

  // Cálculo final com pesos
  const score = (
    dataCompleteness * 0.4 +
    historicalData * 0.2 +
    pipelineHealth * 0.2 +
    goalCoverage * 0.2
  ) * 100;

  // Classificação
  const getLabel = (s: number): ForecastConfidenceResult['label'] => {
    if (s >= 80) return 'Alta';
    if (s >= 60) return 'Moderada';
    if (s >= 40) return 'Baixa';
    return 'Muito Baixa';
  };

  const getColors = (s: number) => {
    if (s >= 80) return { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
    if (s >= 60) return { color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    if (s >= 40) return { color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
    return { color: 'text-red-500', bgColor: 'bg-red-500/10' };
  };

  const colors = getColors(score);

  return {
    score: Math.round(score),
    label: getLabel(score),
    color: colors.color,
    bgColor: colors.bgColor,
    factors: {
      dataCompleteness: Math.round(dataCompleteness * 100),
      historicalData: Math.round(historicalData * 100),
      pipelineHealth: Math.round(pipelineHealth * 100),
      goalCoverage: Math.round(goalCoverage * 100),
    },
    methodology: 'Score calculado com base em: completude dos dados (40%), histórico de vendas (20%), saúde do pipeline (20%) e cobertura da meta (20%).'
  };
}

/**
 * Versão simplificada para quando não temos todos os dados detalhados.
 * Usa estimativas baseadas nos dados disponíveis.
 */
export function calculateSimpleForecastConfidence(params: {
  monthsWithData: number;
  totalWonOpportunities: number;
  openOpportunities: number;
  pipelineValue: number;
  goal: number;
}): ForecastConfidenceResult {
  const { monthsWithData, totalWonOpportunities, openOpportunities, pipelineValue, goal } = params;

  // Estimar completude de dados (assumir 60% como baseline se há oportunidades)
  const estimatedDataCompleteness = openOpportunities > 0 ? 0.6 : 0;
  
  // Dados históricos
  const monthsScore = Math.min(monthsWithData / 12, 1);
  const wonScore = Math.min(totalWonOpportunities / 10, 1);
  const historicalData = (monthsScore * 0.6) + (wonScore * 0.4);

  // Saúde do pipeline (estimar 50% se há oportunidades)
  const pipelineHealth = openOpportunities > 0 ? 0.5 : 0;

  // Cobertura da meta
  const goalCoverage = goal > 0 && pipelineValue > 0 
    ? Math.min(pipelineValue / goal, 1) 
    : 0;

  const score = (
    estimatedDataCompleteness * 0.4 +
    historicalData * 0.2 +
    pipelineHealth * 0.2 +
    goalCoverage * 0.2
  ) * 100;

  const getLabel = (s: number): ForecastConfidenceResult['label'] => {
    if (s >= 80) return 'Alta';
    if (s >= 60) return 'Moderada';
    if (s >= 40) return 'Baixa';
    return 'Muito Baixa';
  };

  const getColors = (s: number) => {
    if (s >= 80) return { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
    if (s >= 60) return { color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    if (s >= 40) return { color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
    return { color: 'text-red-500', bgColor: 'bg-red-500/10' };
  };

  const colors = getColors(score);

  return {
    score: Math.round(score),
    label: getLabel(score),
    color: colors.color,
    bgColor: colors.bgColor,
    factors: {
      dataCompleteness: Math.round(estimatedDataCompleteness * 100),
      historicalData: Math.round(historicalData * 100),
      pipelineHealth: Math.round(pipelineHealth * 100),
      goalCoverage: Math.round(goalCoverage * 100),
    },
    methodology: 'Score calculado com base em: completude dos dados (40%), histórico de vendas (20%), saúde do pipeline (20%) e cobertura da meta (20%).'
  };
}
