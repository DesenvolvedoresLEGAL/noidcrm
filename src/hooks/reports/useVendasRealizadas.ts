/**
 * P0 SSoT — Vendas Realizadas
 * Fonte ÚNICA: commercial_won_revenue_view.
 * Sem fallback legacy. Sem soma local de proposals/valor_previsto.
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

export type CommercialStatus = 'won' | 'lost' | 'open';

export type CommissionStatusValue =
  | 'eligible'
  | 'blocked_review_required'
  | 'blocked_settlement_pending';

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
}


export interface VendasRealizadasFilters {
  start: string;
  end: string;
  sellerUserId?: string | null;
  pipelineId?: string | null;
  revenueType?: 'all' | 'one_time' | 'mrr' | 'mixed';
  commissionStatus?: 'all' | CommissionStatusValue;
}

export interface VendasRealizadasResult {
  rows: VendaRealizadaRow[];
  totals: {
    won_count: number;
    commercial_amount: number;
    one_shot_amount: number;
    mrr_amount: number;
    avg_ticket: number;
    eligible_commission: number;
    review_commission: number;
    settlement_pending_commission: number;
    goal_eligible_amount: number;
    goal_excluded_amount: number;
    goal_excluded_count: number;
  };
}

/**
 * Regra oficial: venda ganha que foi reaberta/removida operacionalmente,
 * ou cujo status comercial virou "perdida", NÃO conta na meta do vendedor.
 */
export function isExcludedFromGoal(r: VendaRealizadaRow): boolean {
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

      // Sempre busca commission_status para enriquecer linhas (badges) e filtrar quando solicitado.
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

      const totals = rows.reduce(
        (acc, r) => {
          acc.won_count += 1;
          const amt = Number(r.commercial_amount) || 0;
          acc.commercial_amount += amt;
          acc.one_shot_amount += Number(r.one_shot_amount) || 0;
          acc.mrr_amount += Number(r.mrr_amount) || 0;
          const cs = r.commission_status;
          if (cs === 'blocked_review_required') acc.review_commission += amt;
          else if (cs === 'blocked_settlement_pending') acc.settlement_pending_commission += amt;
          else acc.eligible_commission += amt;
          if (isExcludedFromGoal(r)) {
            acc.goal_excluded_amount += amt;
            acc.goal_excluded_count += 1;
          } else {
            acc.goal_eligible_amount += amt;
          }
          return acc;
        },
        {
          won_count: 0,
          commercial_amount: 0,
          one_shot_amount: 0,
          mrr_amount: 0,
          avg_ticket: 0,
          eligible_commission: 0,
          review_commission: 0,
          settlement_pending_commission: 0,
          goal_eligible_amount: 0,
          goal_excluded_amount: 0,
          goal_excluded_count: 0,
        },
      );
      totals.avg_ticket = totals.won_count > 0 ? totals.commercial_amount / totals.won_count : 0;

      return { rows, totals };
    },
  });
}

