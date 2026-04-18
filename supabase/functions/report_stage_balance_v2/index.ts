import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { applyCanonicalFilters } from "../_shared/reportFilters.ts";
import { computeConfidence } from "../_shared/reportConfidence.ts";
import { okResponse, errResponse, preflight } from "../_shared/reportResponse.ts";

const REPORT_KEY = "stage_balance_v2";
const VIEW = "v_report_stage_balance_v2";
const COLS = new Set(["organization_id", "pipeline_id", "stage_id"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const parsed = await parseReportRequest(req);
  if (!parsed.ok) {
    return errResponse({ reportKey: REPORT_KEY, code: "BAD_REQUEST", message: parsed.error, status: 400 });
  }
  const { organizationId, filters, options } = parsed.value;
  const auth = await authorize(req, organizationId);
  if (!auth.ok) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: auth.code, message: auth.message, status: auth.status });
  }
  const sb = serviceClient();
  const t0 = Date.now();
  let q = applyCanonicalFilters(
    sb.from(VIEW).select("*").eq("organization_id", organizationId),
    filters,
    { availableColumns: COLS },
  );
  if (options.sortBy) q = q.order(options.sortBy, { ascending: options.sortOrder === "asc" });
  else q = q.order("active_value", { ascending: false });
  q = q.range(options.offset, options.offset + options.limit - 1);
  const { data, error } = await q;
  if (error) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: "QUERY_FAILED", message: error.message, status: 500 });
  }

  // Stage balance leans heavily on history coverage to trust avg_days_in_stage.
  const confidence = await computeConfidence(sb, organizationId, { history: true });
  // If history coverage is unavailable or low, downgrade to 'partial' so the UI never shows fake numbers.
  const historyScore = confidence.breakdown.history;
  if (historyScore === null || historyScore === undefined) {
    confidence.level = "unavailable";
  } else if (typeof historyScore === "number" && historyScore < 50) {
    confidence.level = "partial";
  }

  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: data ?? [],
    filtersApplied: filters,
    confidence,
    rowCount: data?.length ?? 0,
    debug: auth.canDebug ? { view: VIEW, durationMs: Date.now() - t0, historyScore } : undefined,
  });
});
