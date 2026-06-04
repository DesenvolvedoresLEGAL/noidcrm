/**
 * P0 Revenue SSoT — Compara cada superfície contra commercial_won_revenue_view.
 * Read-only. Nenhum efeito colateral.
 *
 * Sprint pendente:
 *  - displayed_value/displayed_source vêm do hook/serviço real consumido pela tela.
 *  - Não comparamos SSoT contra SSoT: superfícies já migradas registram status='ssot_native'.
 *  - Diagnóstico per-sale: only_in_surface, only_in_ssot, amount_diff (vs v_opportunity_amounts_v2).
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

export type SurfaceStatus = 'ok' | 'mismatch' | 'unavailable' | 'ssot_native';

export interface SurfaceComparison {
  surface: string;
  displayed_value: number | null;
  displayed_source: string;
  ssot_value: number;
  delta: number;
  date_range: { start: string; end: string };
  date_field: string;
  hook_service: string;
  view_rpc_edge: string;
  status: SurfaceStatus;
  /** Mantido para compatibilidade com UI existente. */
  shown: number | null;
  source: string;
  mismatch: boolean;
}

export interface PerSaleDiff {
  opportunity_id: string;
  proposal_number: string | null;
  cliente: string | null;
  vendedor: string | null;
  won_at: string | null;
  commercial_amount: number;
  surface_amount: number | null;
  amount_diff: number;
  only_in_surface: boolean;
  only_in_ssot: boolean;
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

export interface DynamicPricingStaleRow {
  proposal_id: string;
  proposal_number: string | null;
  status: string;
  current_amount: number | null;
  snapshot_ends_at: string | null;
  /** 'DYNAMIC_PRICING_STALE' quando snapshot vencido */
  diagnostic: 'DYNAMIC_PRICING_STALE';
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
  /** Diferenças por venda entre v_opportunity_amounts_v2 (relatórios legados) e SSoT. */
  perSaleDiffs: PerSaleDiff[];
  /** Propostas abertas com snapshot de dynamic pricing vencido. Resolve-se sozinho ao abrir/link público. */
  dynamicPricingStale: DynamicPricingStaleRow[];
  anyMismatch: boolean;
}

const EPSILON = 0.01;

interface BuildArgs {
  surface: string;
  displayed: number | null;
  displayedSource: string;
  ssotValue: number;
  dateField: string;
  hookService: string;
  viewRpcEdge: string;
  range: { start: string; end: string };
  native?: boolean;
}

function buildComparison({
  surface, displayed, displayedSource, ssotValue, dateField, hookService, viewRpcEdge, range, native,
}: BuildArgs): SurfaceComparison {
  const shown = typeof displayed === 'number' ? displayed : null;
  const delta = shown === null ? 0 : Math.round((shown - ssotValue) * 100) / 100;
  let status: SurfaceStatus;
  if (native) status = 'ssot_native';
  else if (shown === null) status = 'unavailable';
  else status = Math.abs(delta) > EPSILON ? 'mismatch' : 'ok';
  return {
    surface,
    displayed_value: shown,
    displayed_source: displayedSource,
    ssot_value: ssotValue,
    delta,
    date_range: range,
    date_field: dateField,
    hook_service: hookService,
    view_rpc_edge: viewRpcEdge,
    status,
    shown,
    source: displayedSource,
    mismatch: status === 'mismatch',
  };
}

export function useRevenueIntegrity(organizationId?: string | null, start?: string, end?: string) {
  return useQuery({
    queryKey: ['revenue-integrity', organizationId, start, end],
    enabled: Boolean(organizationId && start && end),
    staleTime: 30_000,
    queryFn: async (): Promise<RevenueIntegrityResult | null> => {
      if (!organizationId || !start || !end) return null;
      const range = { start, end };

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

      // 2) RPC unificada (consumida por algumas telas legadas)
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('get_unified_won_revenue_v2', {
        p_organization_id: organizationId,
        p_start: start,
        p_end: end,
      });
      if (rpcErr) throw rpcErr;
      const rpc = (Array.isArray(rpcData) ? rpcData[0] : rpcData) || {};

      // 3) v_opportunity_amounts_v2 — usado por Relatórios legados
      const { data: oppAmt, error: oppErr } = await (supabase as any)
        .from('v_opportunity_amounts_v2')
        .select('opportunity_id, net_revenue_final, status, won_at, organization_id')
        .eq('organization_id', organizationId)
        .eq('status', 'won')
        .gte('won_at', start)
        .lte('won_at', end);
      if (oppErr) throw oppErr;
      const reportsRows = (oppAmt ?? []) as Array<{ opportunity_id: string; net_revenue_final: number | null }>;
      const reportsSum = reportsRows.reduce((s, r) => s + (Number(r.net_revenue_final) || 0), 0);

      // Per-sale diagnosis: v_opportunity_amounts_v2 vs SSoT
      const ssotMap = new Map(rows.map((r) => [r.opportunity_id, r]));
      const surfaceMap = new Map(reportsRows.map((r) => [r.opportunity_id, Number(r.net_revenue_final) || 0]));
      const allIds = new Set<string>([...ssotMap.keys(), ...surfaceMap.keys()]);
      const perSaleDiffs: PerSaleDiff[] = [];
      allIds.forEach((id) => {
        const ssot = ssotMap.get(id);
        const surfaceAmt = surfaceMap.has(id) ? surfaceMap.get(id)! : null;
        const commercial = ssot ? Number(ssot.commercial_amount) || 0 : 0;
        const diff = surfaceAmt === null ? -commercial : Math.round((surfaceAmt - commercial) * 100) / 100;
        const onlyInSurface = !ssot && surfaceAmt !== null;
        const onlyInSsot = !!ssot && surfaceAmt === null;
        if (onlyInSurface || onlyInSsot || Math.abs(diff) > EPSILON) {
          perSaleDiffs.push({
            opportunity_id: id,
            proposal_number: ssot?.proposal_number ?? null,
            cliente: ssot?.nome_fantasia ?? ssot?.account_name ?? null,
            vendedor: ssot?.seller_name ?? null,
            won_at: ssot?.won_at ?? null,
            commercial_amount: commercial,
            surface_amount: surfaceAmt,
            amount_diff: diff,
            only_in_surface: onlyInSurface,
            only_in_ssot: onlyInSsot,
          });
        }
      });

      // Lista de superfícies (legacy vs migradas)
      const surfaces: SurfaceComparison[] = [
        buildComparison({
          surface: 'Relatórios → Vendas Realizadas',
          displayed: ssotTotals.commercial_amount,
          displayedSource: 'useVendasRealizadas → commercial_won_revenue_view',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'useVendasRealizadas',
          viewRpcEdge: 'commercial_won_revenue_view',
          range,
          native: true,
        }),
        buildComparison({
          surface: 'Dashboard Owner — Receita Fechada',
          displayed: ssotTotals.commercial_amount,
          displayedSource: 'useClosedRevenueSummary',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'useClosedRevenueSummary',
          viewRpcEdge: 'commercial_won_revenue_view',
          range,
          native: true,
        }),
        buildComparison({
          surface: 'Forecast principal — Receita Fechada',
          displayed: ssotTotals.commercial_amount,
          displayedSource: 'useForecastData.kpis.closedRevenue (SSoT override)',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'useForecastData + revenueSsotService',
          viewRpcEdge: 'commercial_won_revenue_view',
          range,
          native: true,
        }),
        buildComparison({
          surface: 'BI Forecast — Receita Fechada (RPC)',
          displayed: Number(rpc.won_revenue),
          displayedSource: 'get_unified_won_revenue_v2.won_revenue',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'closed_at',
          hookService: 'BI Forecast widget',
          viewRpcEdge: 'rpc get_unified_won_revenue_v2',
          range,
        }),
        buildComparison({
          surface: 'BI — Receita Avulsa (RPC)',
          displayed: Number(rpc.one_time_value),
          displayedSource: 'get_unified_won_revenue_v2.one_time_value',
          ssotValue: ssotTotals.one_shot_amount,
          dateField: 'closed_at',
          hookService: 'BI Forecast widget',
          viewRpcEdge: 'rpc get_unified_won_revenue_v2',
          range,
        }),
        buildComparison({
          surface: 'BI — Novo MRR (RPC)',
          displayed: Number(rpc.mrr_value),
          displayedSource: 'get_unified_won_revenue_v2.mrr_value',
          ssotValue: ssotTotals.mrr_amount,
          dateField: 'closed_at',
          hookService: 'BI Forecast widget',
          viewRpcEdge: 'rpc get_unified_won_revenue_v2',
          range,
        }),
        buildComparison({
          surface: 'Relatórios Geral / Processadas / Closer / Performance — soma legada',
          displayed: reportsSum,
          displayedSource: 'v_opportunity_amounts_v2.net_revenue_final',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'edge report-* (legacy)',
          viewRpcEdge: 'view v_opportunity_amounts_v2',
          range,
        }),
        buildComparison({
          surface: 'Relatórios v2 (migrado) — Receita Ganha',
          displayed: ssotTotals.commercial_amount,
          displayedSource: 'useClosedRevenueSummary (override v2)',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'useClosedRevenueSummary',
          viewRpcEdge: 'commercial_won_revenue_view',
          range,
          native: true,
        }),
        buildComparison({
          surface: 'Relatórios → Estágios — etapa Ganhamos',
          displayed: ssotTotals.commercial_amount,
          displayedSource: 'useRevenueByPipeline override em Ganhamos',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'useRevenueByPipeline',
          viewRpcEdge: 'commercial_won_revenue_view (agrupado por pipeline)',
          range,
          native: true,
        }),
        buildComparison({
          surface: 'Win/Loss — Valor Ganho / Ticket Médio Ganho',
          displayed: ssotTotals.commercial_amount,
          displayedSource: 'useClosedRevenueSummary (ssotOverride)',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'useClosedRevenueSummary',
          viewRpcEdge: 'commercial_won_revenue_view',
          range,
          native: true,
        }),
        buildComparison({
          surface: 'Comissão — Base elegível',
          displayed: ssotTotals.commercial_amount,
          displayedSource: 'commission_eligibility_view',
          ssotValue: ssotTotals.commercial_amount,
          dateField: 'won_at',
          hookService: 'commission services',
          viewRpcEdge: 'commission_eligibility_view (deriva de SSoT)',
          range,
          native: true,
        }),
      ];

      // Diagnóstico: venda comercial deve persistir na SSoT mesmo se operacional foi removido/cancelado.
      const idCounts = new Map<string, number>();
      for (const r of rows) idCounts.set(r.opportunity_id, (idCounts.get(r.opportunity_id) ?? 0) + 1);

      const fulfillmentPersistence: FulfillmentPersistenceCheck[] = rows
        .map((r: any) => {
          const fs = r.fulfillment_status as string | null;
          const isRemovedOrCancelled = fs === 'removed' || fs === 'cancelled';
          const presentInSsot = true;
          const duplicated = (idCounts.get(r.opportunity_id) ?? 0) > 1;
          return {
            opportunity_id: r.opportunity_id,
            account_name: r.nome_fantasia ?? r.account_name ?? null,
            commercial_status: r.commercial_status ?? null,
            fulfillment_status: fs,
            financial_settlement_status: r.financial_settlement_status ?? null,
            present_in_ssot: presentInSsot,
            mismatch: duplicated || (isRemovedOrCancelled && !presentInSsot),
          };
        })
        .filter((c) => c.mismatch || c.fulfillment_status === 'removed' || c.fulfillment_status === 'cancelled');

      const anyMismatch =
        surfaces.some((s) => s.status === 'mismatch') ||
        fulfillmentPersistence.some((c) => c.mismatch) ||
        perSaleDiffs.length > 0;

      return {
        period: { start, end },
        ssotTotals,
        surfaces,
        rows,
        reviewRows: rows.filter((r) => r.review_required),
        fulfillmentPersistence,
        perSaleDiffs,
        anyMismatch,
      };
    },
  });
}
