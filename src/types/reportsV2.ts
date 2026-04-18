/**
 * Sprint 2.2 — Tipos canônicos da camada monetária V2.
 *
 * Estes tipos refletem as views SQL:
 *   - public.v_opportunity_amounts_v2
 *   - public.v_opportunity_amount_coverage_v2
 *
 * Toda nova métrica monetária V2 deve consumir estas interfaces.
 */

export type AmountSource =
  | 'accepted_proposal_net'
  | 'latest_commercial_proposal_net'
  | 'opportunity_estimated_fallback'
  | 'zero_fallback';

export type OpportunityStatus = 'new' | 'open' | 'won' | 'lost' | string;

export interface OpportunityAmountV2 {
  opportunity_id: string;
  organization_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  owner_user_id: string | null;
  qualified_by_user_id: string | null;
  status: OpportunityStatus;

  opportunity_estimated_amount: number;

  accepted_proposal_id: string | null;
  accepted_proposal_status: string | null;
  accepted_proposal_net_amount: number | null;
  accepted_proposal_gross_amount: number | null;
  accepted_proposal_discount_amount: number | null;
  accepted_proposal_accepted_at: string | null;

  latest_proposal_id: string | null;
  latest_proposal_status: string | null;
  latest_proposal_net_amount: number | null;
  latest_proposal_gross_amount: number | null;
  latest_proposal_discount_amount: number | null;
  latest_proposal_updated_at: string | null;

  commercial_amount_current: number;
  net_revenue_final: number;
  amount_source: AmountSource;

  reference_proposal_id: string | null;
  reference_proposal_status: string | null;
  commercial_amount_updated_at: string | null;

  has_accepted_proposal: boolean;
  has_any_commercial_proposal: boolean;

  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  close_date_prevista: string | null;
}

export interface AmountCoverageV2 {
  organization_id: string;
  total_opportunities: number;
  using_accepted_proposal_net: number;
  using_latest_proposal_net: number;
  using_opportunity_fallback: number;
  using_zero_fallback: number;
  proposal_based_coverage_pct: number;
}

export interface OpportunityAmountsV2Filters {
  pipelineIds?: string[];
  ownerIds?: string[];
  status?: OpportunityStatus[];
  dateRange?: {
    from: string; // ISO
    to: string;   // ISO
    field?: 'created_at' | 'closed_at' | 'won_at' | 'lost_at' | 'commercial_amount_updated_at';
  };
}
