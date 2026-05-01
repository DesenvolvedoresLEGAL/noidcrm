export type ConfidenceLevel = 'high' | 'moderate' | 'low' | 'critical';

export type ForecastPosition =
  | 'above_goal_secure'
  | 'above_goal_risky'
  | 'near_goal'
  | 'below_goal_recoverable'
  | 'below_goal_critical'
  | 'no_goal_configured';

export type AdjustmentType =
  | 'maintain'
  | 'reduce'
  | 'increase_with_caution'
  | 'manual_review'
  | 'no_goal';

export type SignalImpact = 'high' | 'medium' | 'low';
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ConfidenceReason {
  label: string;
  value: number;
  available?: boolean;
}

export interface ForecastSignal {
  type: string;
  label: string;
  value: string | number;
  impact?: SignalImpact;
  severity?: SignalSeverity;
}

export interface ForecastAdjustmentRecommendation {
  type: AdjustmentType;
  label: string;
  current_realistic: number;
  recommended_realistic: number;
  adjustment_amount: number;
  adjustment_percentage: number;
  reason: string;
}

export interface ContaminatedForecast {
  amount: number;
  deals_count: number;
  reasons: string[];
}

export interface ForecastPriorityAction {
  title: string;
  description: string;
  action_type: string;
  priority: SignalSeverity;
  estimated_recovered_amount: number;
  related_deals_count: number;
  seller_id: string | null;
}

export interface ForecastManagerDecision {
  question: string;
  context: string;
  suggested_decision: string;
  financial_impact: number;
  urgency: SignalSeverity;
}

export interface ForecastSellerAlert {
  seller_id: string;
  seller_name: string | null;
  alert_type: string;
  label: string;
  severity: SignalSeverity;
  amount: number;
}

export interface ForecastIntelligenceDeal {
  opportunity_id: string;
  deal_name: string | null;
  company_name: string | null;
  seller_id: string | null;
  deal_value: number;
  adjusted_value: number;
  forecast_bucket: string;
  risk_level: string | null;
  close_date: string | null;
  penalty_reasons?: string[] | null;
  nrhs_score?: number | null;
  activity_factor?: number | null;
}

export interface IntelligenceMetadata {
  calculation_version: string;
  snapshots_count: number;
  accuracy_score: number | null;
  bias_direction: 'overestimating' | 'underestimating' | 'balanced' | 'unknown';
  forecast_trend: 'improving' | 'worsening' | 'stable' | 'unknown';
  monthly_goal: number | null;
  closed_amount: number;
  scenario_realistic: number;
  scenario_optimistic: number;
  scenario_best_case: number;
  scenario_pessimistic: number;
  pipeline_total: number;
  deals_count: number;
  included_deals_count: number;
  has_run: boolean;
  period_start: string;
  period_end: string;
  pipeline_id: string | null;
  seller_id: string | null;
  generated_at: string;
}

export interface ForecastIntelligenceV2 {
  executive_summary: string;
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  confidence_reasons: ConfidenceReason[];
  forecast_position: ForecastPosition;
  forecast_adjustment_recommendation: ForecastAdjustmentRecommendation;
  positive_signals: ForecastSignal[];
  risk_signals: ForecastSignal[];
  priority_actions: ForecastPriorityAction[];
  manager_decisions: ForecastManagerDecision[];
  seller_alerts: ForecastSellerAlert[];
  contaminated_forecast: ContaminatedForecast;
  top_risky_deals: ForecastIntelligenceDeal[];
  top_recovery_deals: ForecastIntelligenceDeal[];
  metadata: IntelligenceMetadata;
}
