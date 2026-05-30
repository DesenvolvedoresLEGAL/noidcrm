/**
 * P0 SSoT — Vendas Realizadas
 * Fonte ÚNICA: commercial_won_revenue_view.
 * SPRINT REL V2.10 — separa Receita Aprovada / Cancelada / Válida / Liquidada.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export type FulfillmentStatus =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'removed'
  | 'not_started'
  | 'not_applicable';

export type FinancialSettlementStatus =
  | 'settled'
  | 'pending_payment'
  | 'pending_settlement_decision'
  | 'pending_cancellation_fee'
  | 'pending_credit_decision'
  | 'manual_review';

export type CommercialStatus = 'won' | 'lost' | 'open' | 'accepted';

export type CommissionStatusValue =
  | 'eligible'
  | 'blocked_review_required'
  | 'blocked_settlement_pending'
  | 'blocked_cancelled';

export interface VendaRealizadaRow {
  organization_id: string;
  opportunity_id: string;
  opportunity_title?: string | null;
  accepted_proposal_id: string | null;
  proposal_number: string | null;
  account_id?: string | null;
  account_name: string | null;
  nome_fantasia: string | null;
  seller_id?: string | null;
  seller_name: string | null;
  pipeline_id?: string | null;
  pipeline_name?: string | null;
  won_at: string | null;
  commercial_amount: number;
  mrr_amount: number;
  one_shot_amount: number;
  commercial_amount_source: string;
  revenue_confidence: 'trusted' | 'warning' | 'manual_review';
  review_required: boolean;
  warnings: string[];
  commercial_status?: CommercialStatus | null;
  fulfillment_status?: FulfillmentStatus | null;
  financial_settlement_status?: FinancialSettlementStatus | null;
  commission_status?: CommissionStatusValue | null;
  // SPRINT REL V2.10
  is_cancelled_sale?: boolean;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  approved_amount?: number;
  cancelled_amount?: number;
  valid_revenue_amount?: number;
  liquidated_amount?: number;
  commission_eligible_amount?: number;
  sale_status_label?: string;
  delivery_status_label?: string;
  financial_status_label?: string;
  commission_status_label?: string;
  audit_status_label?: string;
}

export type SaleStatusFilter = 'all' | 'valid' | 'cancelled' | 'review';
export type FinancialStatusFilter = 'all' | 'settled' | 'pending' | 'cancelled';

export interface VendasRealizadasFilters {
  start: string;
  end: string;
  sellerUserId?: string | null;
  pipelineId?: string | null;
  revenueType?: 'all' | 'one_time' | 'mrr' | 'mixed';
  commissionStatus?: 'all' | CommissionStatusValue;
  saleStatus?: SaleStatusFilter;
  financialStatus?: FinancialStatusFilter;
}

export interface VendasRealizadasResult {
  rows: VendaRealizadaRow[];
  totals: {
    won_count: number;
    commercial_amount: number; // legacy: aprovada bruta
    one_shot_amount: number;
    mrr_amount: number;
    avg_ticket: number; // legacy (sobre tudo)
    // SPRINT REL V2.10
    approved_amount: number;
    cancelled_amount: number;
    valid_revenue_amount: number;
    liquidated_amount: number;
    valid_count: number;
    cancelled_count: number;
    valid_avg_ticket: number;
    eligible_commission: number; // só vendas válidas e elegíveis
    review_commission: number;
    settlement_pending_commission: number;
    cancelled_commission: number;
    goal_eligible_amount: number; // == valid_revenue_amount
    goal_excluded_amount: number; // == cancelled_amount
    goal_excluded_count: number;
  };
}

/**
 * Venda cancelada NÃO conta em meta/comissão.
 */
export function isExcludedFromGoal(r: VendaRealizadaRow): boolean {
  if (r.is_cancelled_sale === true) return true;
  const f = (r.fulfillment_status ?? '').toLowerCase();
  const c = (r.commercial_status ?? '').toLowerCase();
  return f === 'removed' || f === 'cancelled' || c === 'lost';
}

export function useVendasRealizadas(filters: VendasRealizadasFilters) {
  const { profile } = useCurrentUser();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['vendas-realizadas', organizationId, filters],
    enabled: Boolean(organizationId && filters.start && filters.end),
    staleTime: 30_000,
    queryFn: async (): Promise<VendasRealizadasResult> => {
      if (!organizationId) throw new Error('No organization');

      let q = (supabase as any)
        .from('commercial_won_revenue_view')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('won_at', filters.start)
        .lte('won_at', filters.end)
        .order('won_at', { ascending: false });

      if (filters.sellerUserId) q = q.eq('seller_id', filters.sellerUserId);
      if (filters.pipelineId) q = q.eq('pipeline_id', filters.pipelineId);

      const { data, error } = await q;
      if (error) throw error;

      let rows = (data ?? []) as VendaRealizadaRow[];

      const { data: elig } = await (supabase as any)
        .from('commission_eligibility_view')
        .select('opportunity_id, commission_status')
        .eq('organization_id', organizationId);
      const commissionMap = new Map<string, CommissionStatusValue>(
        (elig ?? []).map((e: any) => [e.opportunity_id, e.commission_status as CommissionStatusValue]),
      );
      rows = rows.map((r) => ({
        ...r,
        commission_status: commissionMap.get(r.opportunity_id) ?? r.commission_status ?? null,
      }));

      if (filters.revenueType && filters.revenueType !== 'all') {
        rows = rows.filter((r) => {
          const hasMrr = (Number(r.mrr_amount) || 0) > 0;
          const hasOne = (Number(r.one_shot_amount) || 0) > 0;
          if (filters.revenueType === 'mrr') return hasMrr && !hasOne;
          if (filters.revenueType === 'one_time') return hasOne && !hasMrr;
          if (filters.revenueType === 'mixed') return hasMrr && hasOne;
          return true;
        });
      }

      if (filters.commissionStatus && filters.commissionStatus !== 'all') {
        rows = rows.filter((r) => r.commission_status === filters.commissionStatus);
      }

      if (filters.saleStatus && filters.saleStatus !== 'all') {
        rows = rows.filter((r) => {
          const cancelled = r.is_cancelled_sale === true || isExcludedFromGoal(r);
          if (filters.saleStatus === 'cancelled') return cancelled;
          if (filters.saleStatus === 'review') return !cancelled && r.review_required === true;
          if (filters.saleStatus === 'valid') return !cancelled && r.review_required !== true;
          return true;
        });
      }

      if (filters.financialStatus && filters.financialStatus !== 'all') {
        rows = rows.filter((r) => {
          const cancelled = r.is_cancelled_sale === true || isExcludedFromGoal(r);
          const fs = r.financial_settlement_status;
          if (filters.financialStatus === 'cancelled') return cancelled;
          if (filters.financialStatus === 'settled') return !cancelled && fs === 'settled';
          if (filters.financialStatus === 'pending') {
            return !cancelled && (
              fs === 'pending_payment' ||
              fs === 'pending_settlement_decision' ||
              fs === 'pending_cancellation_fee' ||
              fs === 'pending_credit_decision'
            );
          }
          return true;
        });
      }

      const totals = rows.reduce(
        (acc, r) => {
          const amt = Number(r.commercial_amount) || 0;
          const approved = Number(r.approved_amount ?? amt) || 0;
          const cancelledAmt = Number(r.cancelled_amount ?? 0) || 0;
          const validAmt = Number(r.valid_revenue_amount ?? (r.is_cancelled_sale ? 0 : amt)) || 0;
          const liquidated = Number(r.liquidated_amount ?? 0) || 0;
          const cancelled = r.is_cancelled_sale === true || isExcludedFromGoal(r);

          acc.won_count += 1;
          acc.commercial_amount += amt;
          acc.one_shot_amount += Number(r.one_shot_amount) || 0;
          acc.mrr_amount += Number(r.mrr_amount) || 0;

          acc.approved_amount += approved;
          acc.cancelled_amount += cancelledAmt;
          acc.valid_revenue_amount += validAmt;
          acc.liquidated_amount += liquidated;

          if (cancelled) {
            acc.cancelled_count += 1;
            acc.goal_excluded_amount += approved;
            acc.goal_excluded_count += 1;
            acc.cancelled_commission += approved;
          } else {
            acc.valid_count += 1;
            acc.goal_eligible_amount += validAmt;
            const cs = r.commission_status;
            if (cs === 'blocked_review_required') acc.review_commission += validAmt;
            else if (cs === 'blocked_settlement_pending') acc.settlement_pending_commission += validAmt;
            else if (cs === 'eligible' || !cs) acc.eligible_commission += validAmt;
          }
          return acc;
        },
        {
          won_count: 0,
          commercial_amount: 0,
          one_shot_amount: 0,
          mrr_amount: 0,
          avg_ticket: 0,
          approved_amount: 0,
          cancelled_amount: 0,
          valid_revenue_amount: 0,
          liquidated_amount: 0,
          valid_count: 0,
          cancelled_count: 0,
          valid_avg_ticket: 0,
          eligible_commission: 0,
          review_commission: 0,
          settlement_pending_commission: 0,
          cancelled_commission: 0,
          goal_eligible_amount: 0,
          goal_excluded_amount: 0,
          goal_excluded_count: 0,
        },
      );
      totals.avg_ticket = totals.won_count > 0 ? totals.commercial_amount / totals.won_count : 0;
      totals.valid_avg_ticket = totals.valid_count > 0 ? totals.valid_revenue_amount / totals.valid_count : 0;

      return { rows, totals };
    },
  });
}
