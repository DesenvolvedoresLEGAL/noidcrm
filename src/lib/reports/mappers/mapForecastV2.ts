/**
 * Sprint 2.7 — Mapper puro de Forecast V2.
 * Cenários (pessimist/realistic/optimistic/bestCase) JÁ vêm do edge function.
 */

export interface ForecastV2View {
  primaryPipelineId: string | null;
  closedRevenue: number;
  openPipelineValue: number;
  weightedPipelineValue: number;
  monthlyGoal: number;
  quarterlyGoal: number;
  annualGoal: number;
  reliabilityPct: number | null;
  scenarios: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
    bestCase: number;
  };
  attainmentPct: number | null;
  hasGoal: boolean;
}

/** Edge function `report_forecast_v2` retorna view + scenarios calculados. */
export function mapForecastV2(raw: any | null | undefined): ForecastV2View | null {
  if (!raw) return null;
  const closed = Number(raw.closed_revenue ?? 0);
  const open = Number(raw.open_pipeline_value ?? 0);
  const weighted = Number(raw.weighted_pipeline_value ?? 0);
  const monthlyGoal = Number(raw.monthly_revenue_goal ?? 0);

  const scenarios = raw.scenarios ?? {
    pessimistic: closed + weighted * 0.5,
    realistic: closed + weighted,
    optimistic: closed + weighted * 1.5,
    bestCase: closed + open,
  };

  const hasGoal = monthlyGoal > 0;
  const attainmentPct = hasGoal ? (closed / monthlyGoal) * 100 : null;

  return {
    primaryPipelineId: raw.primary_pipeline_id ?? null,
    closedRevenue: closed,
    openPipelineValue: open,
    weightedPipelineValue: weighted,
    monthlyGoal,
    quarterlyGoal: Number(raw.quarterly_revenue_goal ?? 0),
    annualGoal: Number(raw.annual_revenue_goal ?? 0),
    reliabilityPct: raw.forecast_reliability_pct ?? null,
    scenarios: {
      pessimistic: Number(scenarios.pessimistic ?? 0),
      realistic: Number(scenarios.realistic ?? 0),
      optimistic: Number(scenarios.optimistic ?? 0),
      bestCase: Number(scenarios.bestCase ?? 0),
    },
    attainmentPct,
    hasGoal,
  };
}
