import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { applyCanonicalFilters } from "../_shared/reportFilters.ts";
import { computeConfidence } from "../_shared/reportConfidence.ts";
import { okResponse, errResponse, preflight } from "../_shared/reportResponse.ts";

const REPORT_KEY = "forecast_v2";
const VIEW = "v_report_forecast_v2";
const COLS = new Set(["organization_id"]);

interface ForecastRow {
  organization_id: string;
  primary_pipeline_id: string | null;
  closed_revenue: number | null;
  open_pipeline_value: number | null;
  weighted_pipeline_value: number | null;
  monthly_revenue_goal: number | null;
  quarterly_revenue_goal: number | null;
  annual_revenue_goal: number | null;
  forecast_reliability_pct: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const parsed = await parseReportRequest(req);
  if (!parsed.ok) {
    return errResponse({ reportKey: REPORT_KEY, code: "BAD_REQUEST", message: parsed.error, status: 400 });
  }
  const { organizationId, filters } = parsed.value;
  const auth = await authorize(req, organizationId);
  if (!auth.ok) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: auth.code, message: auth.message, status: auth.status });
  }
  const sb = serviceClient();
  const t0 = Date.now();
  const { data, error } = await applyCanonicalFilters(
    sb.from(VIEW).select("*").eq("organization_id", organizationId),
    filters,
    { availableColumns: COLS },
  ).maybeSingle<ForecastRow>();
  if (error) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: "QUERY_FAILED", message: error.message, status: 500 });
  }

  const closed = Number(data?.closed_revenue ?? 0);
  const open = Number(data?.open_pipeline_value ?? 0);
  const weighted = Number(data?.weighted_pipeline_value ?? 0);

  const scenarios = {
    pessimistic: closed + weighted * 0.5,
    realistic: closed + weighted,
    optimistic: closed + weighted * 1.5,
    bestCase: closed + open,
  };

  // Forecast confidence: reliability_pct + presence of goal + presence of primary pipeline.
  const reliability = Number(data?.forecast_reliability_pct ?? 0);
  const hasGoal =
    !!data?.monthly_revenue_goal ||
    !!data?.quarterly_revenue_goal ||
    !!data?.annual_revenue_goal;
  const hasPipeline = !!data?.primary_pipeline_id;
  const customScore = Math.round(
    reliability * 0.6 + (hasGoal ? 20 : 0) + (hasPipeline ? 20 : 0),
  );

  const confidence = await computeConfidence(sb, organizationId, {
    monetary: true,
    custom: { key: "forecast", score: customScore },
  });

  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: { ...data, scenarios } as ForecastRow & { scenarios: typeof scenarios },
    filtersApplied: filters,
    confidence,
    rowCount: data ? 1 : 0,
    debug: auth.canDebug
      ? { view: VIEW, durationMs: Date.now() - t0, hasGoal, hasPipeline, reliability }
      : undefined,
  });
});
