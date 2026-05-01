export type RiskGroupKey =
  | 'critical_risk'
  | 'attention_risk'
  | 'slipping'
  | 'hygiene_issue'
  | 'no_activity'
  | 'no_next_step'
  | 'low_nrhs'
  | 'expired_close_date'
  | 'contaminated_realistic';

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export type RiskActionType =
  | 'manager_decision_required'
  | 'priority_follow_up'
  | 'fix_slipping'
  | 'fix_hygiene'
  | 'reactivate_stale_deals'
  | 'define_next_steps'
  | 'improve_nrhs'
  | 'fix_expired_close_date'
  | 'review_contaminated_realistic'
  | 'coach_risky_seller'
  | 'move_slipping_to_next_month';

export interface ForecastRiskDealV2 {
  opportunity_id: string;
  deal_name: string | null;
  company_name: string | null;
  seller_id: string | null;
  seller_name: string | null;
  stage_id: string | null;
  stage_name: string | null;
  deal_value: number;
  adjusted_value: number;
  forecast_bucket: string;
  eligibility_status: string;
  risk_level: string | null;
  close_date: string | null;
  last_activity_at: string | null;
  next_step_exists: boolean;
  nrhs_score: number | null;
  forecast_impact: number;
  penalty_reasons: string[];
  exclusion_reasons: string[];
  recommended_action: RiskActionType;
}

export interface ForecastRiskGroupV2 {
  group_key: RiskGroupKey;
  title: string;
  description: string;
  severity: RiskSeverity;
  deals_count: number;
  gross_amount: number;
  adjusted_amount: number;
  forecast_impact: number;
  recoverable_amount: number;
  recommended_action: string;
  action_type: RiskActionType;
  deals: ForecastRiskDealV2[];
}

export interface ForecastSellerRiskRankingV2 {
  seller_id: string;
  seller_name: string | null;
  risk_amount: number;
  risk_deals_count: number;
  slipping_amount: number;
  slipping_deals_count: number;
  hygiene_issue_deals: number;
  contaminated_realistic_amount: number;
  risk_score: number;
  recommended_action: RiskActionType;
}

export interface ForecastQuickActionV2 {
  action_type: RiskActionType;
  title: string;
  description: string;
  deals_count: number;
  amount: number;
  priority: RiskSeverity;
}

export interface ForecastRiskSummaryV2 {
  total_risk_amount: number;
  total_risk_deals: number;
  critical_risk_amount: number;
  critical_risk_deals: number;
  slipping_amount: number;
  slipping_deals: number;
  hygiene_issue_amount: number;
  hygiene_issue_deals: number;
  contaminated_realistic_amount: number;
  contaminated_realistic_deals: number;
  recoverable_amount: number;
  risk_score: number;
}

export interface ForecastRiskMetadataV2 {
  run_id: string | null;
  calculation_version: string | null;
  generated_at: string;
  period_start: string;
  period_end: string;
}

export interface ForecastRiskCenterV2 {
  summary: ForecastRiskSummaryV2;
  groups: ForecastRiskGroupV2[];
  seller_risk_ranking: ForecastSellerRiskRankingV2[];
  top_risky_deals: ForecastRiskDealV2[];
  top_recovery_deals: ForecastRiskDealV2[];
  quick_actions: ForecastQuickActionV2[];
  metadata: ForecastRiskMetadataV2;
  error?: string;
}

export function getRiskScoreLabel(score: number): { label: string; tone: RiskSeverity } {
  if (score >= 80) return { label: 'Crítico', tone: 'critical' };
  if (score >= 60) return { label: 'Alto', tone: 'high' };
  if (score >= 30) return { label: 'Atenção', tone: 'medium' };
  return { label: 'Baixo', tone: 'low' };
}
