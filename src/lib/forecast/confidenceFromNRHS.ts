/**
 * Hotfix Dashboard — fonte única de confiança do Forecast.
 *
 * A página Forecast (`ForecastDataQuality`) mostra `avgNRHS` (média do
 * `nrhs_score` das oportunidades abertas do pipeline de vendas) como
 * indicador principal de confiabilidade. O CEO Dashboard precisa exibir
 * exatamente o mesmo número — então este helper é a fonte única.
 *
 * Mantém o shape de `ForecastConfidenceResult` para não quebrar o
 * componente `OwnerKPICards`.
 */
import type { ForecastConfidenceResult } from '@/services/crm/forecastConfidence';

interface NRHSConfidenceInput {
  /** Oportunidades abertas do pipeline de vendas (mesmo conjunto da página Forecast). */
  openSalesOpportunities: Array<{ nrhs_score?: number | null }>;
}

function getLabel(s: number): ForecastConfidenceResult['label'] {
  if (s >= 80) return 'Alta';
  if (s >= 60) return 'Moderada';
  if (s >= 40) return 'Baixa';
  return 'Muito Baixa';
}

function getColors(s: number) {
  if (s >= 80) return { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
  if (s >= 60) return { color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
  if (s >= 40) return { color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
  return { color: 'text-red-500', bgColor: 'bg-red-500/10' };
}

export function calculateForecastConfidenceFromNRHS(
  input: NRHSConfidenceInput,
): ForecastConfidenceResult {
  const opps = input.openSalesOpportunities ?? [];
  const withScore = opps.filter(
    (o) => o.nrhs_score !== null && o.nrhs_score !== undefined,
  );
  const avgNRHS =
    withScore.length > 0
      ? withScore.reduce((sum, o) => sum + Number(o.nrhs_score || 0), 0) /
        withScore.length
      : 0;
  const score = Math.round(avgNRHS);
  const colors = getColors(score);
  return {
    score,
    label: getLabel(score),
    color: colors.color,
    bgColor: colors.bgColor,
    factors: {
      dataCompleteness: score,
      historicalData: score,
      pipelineHealth: score,
      goalCoverage: score,
    },
    methodology:
      'Confiança baseada no NRHS médio (Net Revenue Health Score) das oportunidades abertas do pipeline de vendas — mesma fonte exibida na página Forecast.',
  };
}
