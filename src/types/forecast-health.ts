export type HealthStatus = 'healthy' | 'attention' | 'critical' | 'not_ready' | 'forbidden';

export interface HealthIssue {
  code: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface DataConsistency {
  closed_matches_pessimistic: boolean;
  snapshot_matches_latest_run: boolean;
  realistic_not_above_best_case: boolean;
  optimistic_not_above_best_case: boolean;
  commit_not_above_best_case: boolean;
  eom_realistic_protected: boolean;
  sellers_with_goal: boolean;
  accuracy_ready: boolean;
}

export interface PerformanceStats {
  last_health_check_ms: number;
  latest_run_age_minutes: number | null;
  latest_snapshot_age_hours: number | null;
  latest_run_duration_ms: number;
  latest_snapshot_duration_ms: number;
}

export interface ForecastV2HealthCheck {
  status: HealthStatus;
  feature_flag_enabled: boolean;
  engine_active?: boolean;
  bootstrap_required?: boolean;
  calculation_version: string | null;
  latest_run_at: string | null;
  latest_snapshot_at: string | null;
  snapshot_job_last_status: string | null;
  snapshots_count: number;
  accuracy_ready: boolean;
  accuracy_score: number | null;
  seller_performance_ready: boolean;
  intelligence_ready: boolean;
  risk_center_ready: boolean;
  data_consistency: DataConsistency;
  performance: PerformanceStats;
  warnings: HealthIssue[];
  errors: HealthIssue[];
  recommendations: string[];
  metadata: {
    organization_id: string;
    pipeline_id: string | null;
    period_start: string;
    period_end: string;
    generated_at: string;
  };
  error?: string;
}

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: 'Forecast V2 saudável',
  attention: 'Atenção necessária',
  critical: 'Crítico',
  not_ready: 'Ainda não pronto',
  forbidden: 'Sem permissão',
};

export const CONSISTENCY_LABELS: Record<keyof DataConsistency, string> = {
  closed_matches_pessimistic: 'Pessimista bate com fechado',
  snapshot_matches_latest_run: 'Snapshot bate com último cálculo',
  realistic_not_above_best_case: 'Realista ≤ Best Case',
  optimistic_not_above_best_case: 'Otimista ≤ Best Case',
  commit_not_above_best_case: 'Commit ≤ Best Case',
  eom_realistic_protected: 'Fim de mês protegido',
  sellers_with_goal: 'Vendedores com meta',
  accuracy_ready: 'Acurácia pronta',
};
