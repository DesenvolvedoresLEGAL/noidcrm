import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { applyCanonicalFilters } from "../_shared/reportFilters.ts";
import { computeConfidence } from "../_shared/reportConfidence.ts";
import { okResponse, errResponse, preflight } from "../_shared/reportResponse.ts";

const REPORT_KEY = "losses_detail_v2";
const VIEW = "v_report_losses_detail_v2";
const COLS = new Set([
  "organization_id", "pipeline_id", "stage_id", "owner_user_id",
  "qualified_by_user_id", "consolidated_loss_reason_id", "created_at",
]);

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
    sb.from(VIEW).select("*", { count: "exact" }).eq("organization_id", organizationId),
    filters,
    { dateColumn: "lost_at", availableColumns: COLS },
  );
  if (options.sortBy) q = q.order(options.sortBy, { ascending: options.sortOrder === "asc" });
  else q = q.order("lost_at", { ascending: false, nullsFirst: false });
  q = q.range(options.offset, options.offset + options.limit - 1);

  const { data, error, count } = await q;
  if (error) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: "QUERY_FAILED", message: error.message, status: 500 });
  }
  const confidence = await computeConfidence(sb, organizationId, { loss: true, monetary: true });
  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: data ?? [],
    filtersApplied: filters,
    confidence,
    rowCount: data?.length ?? 0,
    debug: auth.canDebug
      ? { view: VIEW, durationMs: Date.now() - t0, totalCount: count, limit: options.limit, offset: options.offset }
      : undefined,
  });
});
