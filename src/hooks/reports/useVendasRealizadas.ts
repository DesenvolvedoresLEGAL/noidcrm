/**
 * P0 SSoT — Vendas Realizadas
 * Fonte ÚNICA: commercial_won_revenue_view.
 * Sem fallback legacy. Sem soma local de proposals/valor_previsto.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface VendaRealizadaRow {
  organization_id: string;
  opportunity_id: string;
  opportunity_title?: string | null;
  accepted_proposal_id: string | null;
  proposal_number: string | null;
  account_id?: string | null;
  account_name: string | null;
  nome_fantasia: string | null;
  seller_user_id?: string | null;
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
}

export interface VendasRealizadasFilters {
  start: string;
  end: string;
  sellerUserId?: string | null;
  pipelineId?: string | null;
  revenueType?: 'all' | 'one_time' | 'mrr' | 'mixed';
  commissionStatus?: 'all' | 'eligible' | 'blocked_review_required';
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
    blocked_commission: number;
  };
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

      if (filters.sellerUserId) q = q.eq('seller_user_id', filters.sellerUserId);
      if (filters.pipelineId) q = q.eq('pipeline_id', filters.pipelineId);

      const { data, error } = await q;
      if (error) throw error;

      let rows = (data ?? []) as VendaRealizadaRow[];

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

      // Commission status (join client-side via commission_eligibility_view se necessário).
      if (filters.commissionStatus && filters.commissionStatus !== 'all') {
        const { data: elig } = await (supabase as any)
          .from('commission_eligibility_view')
          .select('opportunity_id, commission_status')
          .eq('organization_id', organizationId);
        const map = new Map<string, string>((elig ?? []).map((e: any) => [e.opportunity_id, e.commission_status]));
        rows = rows.filter((r) => map.get(r.opportunity_id) === filters.commissionStatus);
      }

      const totals = rows.reduce(
        (acc, r) => {
          acc.won_count += 1;
          acc.commercial_amount += Number(r.commercial_amount) || 0;
          acc.one_shot_amount += Number(r.one_shot_amount) || 0;
          acc.mrr_amount += Number(r.mrr_amount) || 0;
          if (r.review_required) acc.blocked_commission += Number(r.commercial_amount) || 0;
          else acc.eligible_commission += Number(r.commercial_amount) || 0;
          return acc;
        },
        {
          won_count: 0,
          commercial_amount: 0,
          one_shot_amount: 0,
          mrr_amount: 0,
          avg_ticket: 0,
          eligible_commission: 0,
          blocked_commission: 0,
        },
      );
      totals.avg_ticket = totals.won_count > 0 ? totals.commercial_amount / totals.won_count : 0;

      return { rows, totals };
    },
  });
}
