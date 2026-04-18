/**
 * Sprint 2.4 — Loss Intelligence V2
 *
 * Tipos canônicos para a camada de inteligência de perdas.
 * Reflete diretamente as views v_loss_*_v2 / v_lost_deals_*_v2.
 */

export type LossReasonSource =
  | 'seller_loss_reason'
  | 'win_loss_record'
  | 'unclassified';

export type LossClassificationStatus =
  | 'fully_classified'
  | 'partially_classified'
  | 'unclassified_legacy'
  | 'unclassified_blocked'
  | 'client_only'
  | 'seller_only'
  | 'win_loss_only';

export type LossCoverageBucket = 'complete' | 'partial' | 'missing';

export interface LossClassificationV2 {
  opportunity_id: string;
  organization_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  owner_user_id: string | null;
  qualified_by_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  closed_at: string | null;
  lost_at: string | null;
  seller_loss_reason_id: string | null;
  client_loss_reason_id: string | null;
  win_loss_reason_id: string | null;
  win_loss_client_reason_id: string | null;
  reason_free_text: string | null;
  win_loss_category: string | null;
  competitor: string | null;
  discount_given: number | null;
  sales_cycle_days: number | null;
  decision_makers: string | null;
  lessons_learned: string | null;
  consolidated_loss_reason_id: string | null;
  loss_reason_source: LossReasonSource;
  loss_classification_status: LossClassificationStatus;
  loss_coverage_bucket: LossCoverageBucket;
}

export interface LostDealV2 extends LossClassificationV2 {
  seller_loss_reason_name: string | null;
  seller_loss_reason_category: string | null;
  client_loss_reason_name: string | null;
  client_loss_reason_category: string | null;
  win_loss_reason_name: string | null;
  win_loss_reason_category: string | null;
}

export interface LostDealAmountV2 extends LostDealV2 {
  commercial_amount_current: number | null;
  amount_source: string | null;
  reference_proposal_id: string | null;
  reference_proposal_status: string | null;
  commercial_amount_updated_at: string | null;
}

export interface LossCoverageV2 {
  organization_id: string;
  total_lost_opportunities: number;
  fully_classified_count: number;
  seller_only_count: number;
  client_only_count: number;
  win_loss_only_count: number;
  unclassified_legacy_count: number;
  complete_coverage_pct: number | null;
  any_coverage_pct: number | null;
}

export interface LossReasonRollupV2 {
  organization_id: string;
  loss_reason_key: string;
  loss_reason_name: string;
  loss_reason_category: string;
  loss_reason_source: LossReasonSource;
  loss_classification_status: LossClassificationStatus;
  lost_count: number;
  with_client_reason_count: number;
}

export interface LostDealsV2Filters {
  pipelineIds?: string[];
  ownerIds?: string[];
  dateRange?: {
    from: string;
    to: string;
    field?: 'lost_at' | 'closed_at' | 'created_at';
  };
}
