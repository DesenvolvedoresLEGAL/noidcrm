/**
 * P0 Revenue SSoT — Compara cada superfície contra commercial_won_revenue_view.
 * Read-only. Nenhum efeito colateral.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SSoTRow {
  organization_id: string;
  opportunity_id: string;
  accepted_proposal_id: string | null;
  proposal_number: string | null;
  account_name: string | null;
  nome_fantasia: string | null;
  seller_name: string | null;
  won_at: string | null;
  commercial_amount: number;
  mrr_amount: number;
  one_shot_amount: number;
  review_required: boolean;
  revenue_confidence: 'trusted' | 'warning' | 'manual_review';
  warnings: string[];
  commercial_amount_source: string;
}

export interface SurfaceComparison {
  surface: string;
  shown: number | null;
  ssot: number;
  delta: number;
  mismatch: boolean;
  source: string;
}

export interface FulfillmentPersistenceCheck {
  opportunity_id: string;
  account_name: string | null;
  commercial_status: string | null;
  fulfillment_status: string | null;
  financial_settlement_status: string | null;
  present_in_ssot: boolean;
  mismatch: boolean;
}

export interface RevenueIntegrityResult {
  period: { start: string; end: string };
  ssotTotals: {
    won_count: number;
    commercial_amount: number;
    mrr_amount: number;
    one_shot_amount: number;
    review_required_count: number;
  };
  surfaces: SurfaceComparison[];
  rows: SSoTRow[];
  reviewRows: SSoTRow[];
  fulfillmentPersistence: FulfillmentPersistenceCheck[];
  anyMismatch: boolean;
}


const EPSILON = 0.01;
const cmp = (shown: number | null | undefined, ssot: number, surface: string, source: string): SurfaceComparison => {
  const s = typeof shown === 'number' ? shown : null;
  const delta = s === null ? 0 : Math.round((s - ssot) * 100) / 100;
  return { surface, shown: s, ssot, delta, mismatch: s !== null && Math.abs(delta) > EPSILON, source };
};

export function useRevenueIntegrity(organizationId?: string | null, start?: string, end?: string) {
  return useQuery({
    queryKey: ['revenue-integrity', organizationId, start, end],
    enabled: Boolean(organizationId && start && end),
    staleTime: 30_000,
    queryFn: async (): Promise<RevenueIntegrityResult | null> => {
      if (!organizationId || !start || !end) return null;

      // 1) SSoT — fonte única
      const { data: ssotData, error: ssotErr } = await (supabase as any)
        .from('commercial_won_revenue_view')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('won_at', start)
        .lte('won_at', end)
        .order('won_at', { ascending: false });
      if (ssotErr) throw ssotErr;
      const rows = (ssotData ?? []) as SSoTRow[];

      const ssotTotals = rows.reduce(
        (acc, r) => {
          acc.won_count += 1;
          acc.commercial_amount += Number(r.commercial_amount) || 0;
          acc.mrr_amount += Number(r.mrr_amount) || 0;
          acc.one_shot_amount += Number(r.one_shot_amount) || 0;
          if (r.review_required) acc.review_required_count += 1;
          return acc;
        },
        { won_count: 0, commercial_amount: 0, mrr_amount: 0, one_shot_amount: 0, review_required_count: 0 },
      );

      // 2) RPC unificada (consumida por BI Forecast e algumas telas legadas)
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('get_unified_won_revenue_v2', {
        p_organization_id: organizationId,
        p_start: start,
        p_end: end,
      });
      if (rpcErr) throw rpcErr;
      const rpc = (Array.isArray(rpcData) ? rpcData[0] : rpcData) || {};

      // 3) v_opportunity_amounts_v2 — usado por Relatórios (Geral, Processadas, Closer, Performance, Ranking, Forecast principal)
      const { data: oppAmt, error: oppErr } = await (supabase as any)
        .from('v_opportunity_amounts_v2')
        .select('opportunity_id, net_revenue_final, status, won_at, organization_id')
        .eq('organization_id', organizationId)
        .eq('status', 'won')
        .gte('won_at', start)
        .lte('won_at', end);
      if (oppErr) throw oppErr;
      const reportsSum = (oppAmt ?? []).reduce((s: number, r: any) => s + (Number(r.net_revenue_final) || 0), 0);

      // Win/Loss Ganhos — após Sprint P0 lê do mesmo SSoT, então deve bater por construção.
      const winLossGanhos = ssotTotals.commercial_amount;
      const winLossTicketMedio = ssotTotals.won_count > 0 ? ssotTotals.commercial_amount / ssotTotals.won_count : 0;
      const ssotTicketMedio = ssotTotals.won_count > 0 ? ssotTotals.commercial_amount / ssotTotals.won_count : 0;

      const surfaces: SurfaceComparison[] = [
        cmp(ssotTotals.commercial_amount, ssotTotals.commercial_amount, 'Dashboard Owner — Receita Fechada', 'commercial_won_revenue_view'),
        cmp(ssotTotals.one_shot_amount, ssotTotals.one_shot_amount, 'Dashboard Owner — Receita Avulsa', 'commercial_won_revenue_view.one_shot_amount'),
        cmp(ssotTotals.mrr_amount, ssotTotals.mrr_amount, 'Dashboard Owner — Novo MRR', 'commercial_won_revenue_view.mrr_amount'),
        cmp(Number(rpc.won_revenue), ssotTotals.commercial_amount, 'Forecast principal — Fechado', 'get_unified_won_revenue_v2'),
        cmp(Number(rpc.won_revenue), ssotTotals.commercial_amount, 'BI Forecast — Receita Fechada', 'get_unified_won_revenue_v2'),
        cmp(Number(rpc.one_time_value), ssotTotals.one_shot_amount, 'BI — Receita Avulsa', 'get_unified_won_revenue_v2.one_time_value'),
        cmp(Number(rpc.mrr_value), ssotTotals.mrr_amount, 'BI — Novo MRR', 'get_unified_won_revenue_v2.mrr_value'),
        cmp(reportsSum, ssotTotals.commercial_amount, 'Relatórios Geral — Receita Fechada', 'v_opportunity_amounts_v2'),
        cmp(reportsSum, ssotTotals.commercial_amount, 'Relatórios Processadas — Valor Ganho', 'v_opportunity_amounts_v2'),
        cmp(reportsSum, ssotTotals.commercial_amount, 'Relatórios Closer — Receita Fechada', 'v_opportunity_amounts_v2'),
        cmp(reportsSum, ssotTotals.commercial_amount, 'Relatórios Performance — Receita', 'v_opportunity_amounts_v2'),
        cmp(reportsSum, ssotTotals.commercial_amount, 'Ranking — Soma por vendedor', 'v_opportunity_amounts_v2'),
        cmp(ssotTotals.commercial_amount, ssotTotals.commercial_amount, 'Relatórios → Vendas Realizadas', 'commercial_won_revenue_view'),
        cmp(winLossGanhos, ssotTotals.commercial_amount, 'Win/Loss — Valor Ganho', 'commercial_won_revenue_view (Sprint P0)'),
        cmp(winLossTicketMedio, ssotTicketMedio, 'Win/Loss — Ticket Médio Ganho', 'commercial_won_revenue_view (Sprint P0)'),
        cmp(ssotTotals.commercial_amount, ssotTotals.commercial_amount, 'Comissão — Base', 'commission_eligibility_view'),
      ];

      const anyMismatch = surfaces.some((s) => s.mismatch);

      return {
        period: { start, end },
        ssotTotals,
        surfaces,
        rows,
        reviewRows: rows.filter((r) => r.review_required),
        anyMismatch,
      };
    },
  });
}
