export type RecommendedActionType =
  | 'configure_goal'
  | 'increase_pipeline'
  | 'recover_risk_deals'
  | 'reactivate_stale_deals'
  | 'define_next_steps'
  | 'maintain_execution';

export interface ForecastSellerPerformance {
  seller_id: string;
  seller_name: string;
  seller_email: string | null;
  seller_avatar_url: string | null;

  monthly_goal: number | null;
  has_goal: boolean;

  closed_amount: number;
  scenario_realistic: number;
  scenario_optimistic: number;
  scenario_best_case: number;

  gap_to_goal: number | null;
  goal_attainment_percentage: number | null;

  pipeline_total: number;
  coverage_ratio: number | null;

  deals_count: number;
  included_deals_count: number;
  excluded_deals_count: number;
  risk_deals_count: number;
  slipping_deals_count: number;

  no_recent_activity_count: number;
  no_next_step_count: number;
  expired_close_date_count: number;
  low_nrhs_count: number;

  nrhs_avg: number;
  forecast_confidence: number;

  risk_amount: number;
  slipping_amount: number;

  recommended_action: string;
  recommended_action_type: RecommendedActionType;

  calculation_version: string;
  run_id: string | null;
}
