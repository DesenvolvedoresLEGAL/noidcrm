import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { applyCanonicalFilters } from "../_shared/reportFilters.ts";
import { computeConfidence } from "../_shared/reportConfidence.ts";
import { okResponse, errResponse, preflight } from "../_shared/reportResponse.ts";

const REPORT_KEY = "processed_v2";
const VIEW = "v_report_processed_v2";
const COLS = new Set(["organization_id"]);

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
  ).maybeSingle();
  if (error) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: "QUERY_FAILED", message: error.message, status: 500 });
  }
  const confidence = await computeConfidence(sb, organizationId, { monetary: true, history: true });
  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: data ?? {
      organization_id: organizationId,
      won_count: 0, won_revenue: 0, avg_won_ticket: 0,
      lost_count: 0, lost_value: 0, avg_lost_ticket: 0,
      processed_count: 0, win_rate_pct: null,
    },
    filtersApplied: filters,
    confidence,
    rowCount: data ? 1 : 0,
    debug: auth.canDebug ? { view: VIEW, durationMs: Date.now() - t0 } : undefined,
  });
});
