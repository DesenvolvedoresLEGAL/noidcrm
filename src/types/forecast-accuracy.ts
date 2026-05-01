export type ForecastBias = 'overestimating' | 'underestimating' | 'balanced' | 'unknown';
export type ForecastTrend = 'improving' | 'worsening' | 'stable' | 'unknown';

export interface ForecastAccuracySnapshotRef {
  snapshot_date: string | null;
  realistic_error_percentage: number | null;
  realistic_error_amount: number | null;
  scenario_realistic: number | null;
  actual_closed_amount: number | null;
  accuracy_score: number | null;
}

export interface ForecastAccuracySummary {
  actual_closed_amount: number;
  snapshots_count: number;
  avg_realistic_forecast: number;
  last_realistic_forecast: number;
  avg_error_amount: number;
  avg_error_percentage: number;
  mape: number;
  accuracy_score: number;
  bias_direction: ForecastBias;
  best_snapshot: ForecastAccuracySnapshotRef | Record<string, never>;
  worst_snapshot: ForecastAccuracySnapshotRef | Record<string, never>;
  forecast_trend: ForecastTrend;
  calculation_version: string;
  seller_id: string | null;
}

export interface ForecastSellerAccuracy {
  seller_id: string;
  seller_name: string;
  seller_email: string | null;
  snapshots_count: number;
  actual_closed_amount: number;
  avg_realistic_forecast: number;
  last_realistic_forecast: number;
  avg_error_percentage: number;
  accuracy_score: number;
  bias_direction: ForecastBias;
  forecast_trend: ForecastTrend;
  calculation_version: string;
}

export const BIAS_LABELS: Record<ForecastBias, string> = {
  overestimating: 'Inflando forecast',
  underestimating: 'Subestimando forecast',
  balanced: 'Equilibrado',
  unknown: 'Sem dados suficientes',
};

export const TREND_LABELS: Record<ForecastTrend, string> = {
  improving: 'Melhorando',
  worsening: 'Piorando',
  stable: 'Estável',
  unknown: 'Sem dados suficientes',
};
