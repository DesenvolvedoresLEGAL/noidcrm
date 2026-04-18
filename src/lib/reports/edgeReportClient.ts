/**
 * Sprint 2.6 — Generic client for V2 report edge functions.
 *
 * Use callReportEdgeFunction to invoke any of the canonical report_*_v2 functions
 * with a typed envelope ReportEdgeResponse<T>.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ReportEdgeRequest,
  ReportEdgeResponse,
} from "@/types/reportEdgeV2";

export const REPORT_EDGE_FUNCTION_NAMES = {
  summary: "report_summary_v2",
  processed: "report_processed_v2",
  losses: "report_losses_v2",
  losses_detail: "report_losses_detail_v2",
  origins: "report_origins_v2",
  forecast: "report_forecast_v2",
  team: "report_team_v2",
  closer: "report_closer_v2",
  sdr: "report_sdr_v2",
  handoff: "report_handoff_v2",
  stage_balance: "report_stage_balance_v2",
  stage_conversion: "report_stage_conversion_v2",
  accumulated: "report_accumulated_v2",
  reconcile: "report_reconcile_v2",
} as const;

export type ReportEdgeKey = keyof typeof REPORT_EDGE_FUNCTION_NAMES;

export async function callReportEdgeFunction<T>(
  name: (typeof REPORT_EDGE_FUNCTION_NAMES)[ReportEdgeKey] | string,
  payload: ReportEdgeRequest,
): Promise<ReportEdgeResponse<T>> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload,
  });

  if (error) {
    return {
      success: false,
      data: null,
      meta: {
        reportKey: name,
        organizationId: payload.organizationId,
        generatedAt: new Date().toISOString(),
        filtersApplied: payload.filters ?? null,
        rowCount: 0,
        confidence: null,
        status: "unavailable",
      },
      error: { code: "INVOKE_FAILED", message: error.message },
    };
  }

  // The edge function already returns a proper envelope.
  return data as ReportEdgeResponse<T>;
}
