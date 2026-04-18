/**
 * Sprint 2.5 — Tipos canônicos da camada de relatórios V2.
 *
 * Estes tipos refletem as views SQL `v_report_*_v2` e a base unificada
 * `v_reporting_opportunities_v2`. Toda nova consulta de relatório deve
 * consumir estas interfaces.
 */

import type { AmountSource } from './reportsV2';
import type {
  LossReasonSource,
  LossClassificationStatus,
  LossCoverageBucket,
} from './lossV2';

export interface ReportingOpportunityV2 {
  opportunity_id: string;
  organization_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  owner_user_id: string | null;
  current_owner_user_id: string | null;
  first_owner_user_id: string | null;
  qualified_by_user_id: string | null;
  first_qualification_at: string | null;
  status: string;
  origem: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  close_date_prevista: string | null;
  opportunity_estimated_amount: number | null;
  commercial_amount_current: number | null;
  net_revenue_final: number | null;
  amount_source: AmountSource | null;
  reference_proposal_id: string | null;
  reference_proposal_status: string | null;
  commercial_amount_updated_at: string | null;
  has_accepted_proposal: boolean | null;
  has_any_commercial_proposal: boolean | null;
  entered_current_stage_at: string | null;
  hours_in_current_stage: number | null;
  days_in_current_stage: number | null;
  seller_loss_reason_id: string | null;
  client_loss_reason_id: string | null;
  win_loss_reason_id: string | null;
  consolidated_loss_reason_id: string | null;
  loss_reason_source: LossReasonSource | null;
  loss_classification_status: LossClassificationStatus | null;
  loss_coverage_bucket: LossCoverageBucket | null;
  pipeline_type: string | null;
  pipeline_is_primary: boolean | null;
}

export interface ReportSummaryV2 {
  organization_id: string;
  active_pipeline_count: number;
  active_pipeline_value: number;
  won_count: number;
  won_revenue: number;
  lost_count: number;
  lost_value: number;
  processed_count: number;
  win_rate_pct: number | null;
  avg_won_ticket: number;
}

export interface ReportProcessedV2 {
  organization_id: string;
  won_count: number;
  won_revenue: number;
  avg_won_ticket: number;
  lost_count: number;
  lost_value: number;
  avg_lost_ticket: number;
  processed_count: number;
  win_rate_pct: number | null;
}

export interface ReportLossesV2 {
  organization_id: string;
  consolidated_loss_reason_id: string | null;
  loss_reason_source: LossReasonSource | null;
  loss_classification_status: LossClassificationStatus | null;
  loss_coverage_bucket: LossCoverageBucket | null;
  lost_count: number;
  lost_value: number;
  avg_lost_ticket: number;
}

export interface ReportOriginsV2 {
  organization_id: string;
  origin_name: string;
  total_count: number;
  won_count: number;
  lost_count: number;
  open_count: number;
  won_revenue: number;
  open_pipeline_value: number;
  win_rate_pct: number | null;
  avg_won_ticket: number;
}

export interface ReportForecastV2 {
  organization_id: string;
  primary_pipeline_id: string | null;
  closed_revenue: number;
  open_pipeline_value: number;
  weighted_pipeline_value: number;
  monthly_revenue_goal: number;
  quarterly_revenue_goal: number;
  annual_revenue_goal: number;
  forecast_reliability_pct: number | null;
}

export interface ReportTeamV2 {
  organization_id: string;
  owner_user_id: string;
  owner_name: string | null;
  won_count: number;
  lost_count: number;
  active_count: number;
  won_revenue: number;
  active_pipeline_value: number;
  win_rate_pct: number | null;
  avg_won_ticket: number;
}

export interface ReportCloserV2 {
  organization_id: string;
  closer_user_id: string;
  closer_name: string | null;
  won_count: number;
  lost_count: number;
  active_count: number;
  won_revenue: number;
  active_pipeline_value: number;
  win_rate_pct: number | null;
  avg_won_ticket: number;
  avg_sales_cycle_days: number | null;
}

export interface ReportSDRV2 {
  organization_id: string;
  sdr_user_id: string;
  sdr_name: string | null;
  sqls_generated: number;
  won_count: number;
  lost_count: number;
  revenue_attributed: number;
  win_rate_pct: number | null;
  avg_qualification_hours: number | null;
}

export interface ReportHandoffV2 {
  organization_id: string;
  sdr_user_id: string;
  closer_user_id: string;
  sdr_name: string | null;
  closer_name: string | null;
  total_handoffs: number;
  won_count: number;
  lost_count: number;
  won_revenue: number;
  avg_qualification_hours: number | null;
  win_rate_pct: number | null;
}

export interface ReportStageBalanceV2 {
  organization_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  stage_name: string | null;
  active_count: number;
  active_value: number;
  avg_days_in_stage: number | null;
}

export interface ReportStageConversionV2 {
  organization_id: string;
  pipeline_id: string | null;
  from_stage_id: string;
  from_stage_name: string | null;
  to_stage_id: string;
  to_stage_name: string | null;
  transition_count: number;
  transition_rate_pct: number | null;
}

export interface ReportAccumulatedV2 {
  organization_id: string;
  day: string;
  created_count: number;
  created_value: number;
}
