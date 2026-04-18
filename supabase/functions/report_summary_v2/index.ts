// Sprint 2.12 — Reescrita: agrega INLINE a partir de v_reporting_opportunities_v2.
// Aplica filtro de período via closed_at (won/lost) ao invés de ler view agregada all-time.
// Garante que "Este mês" mostre exatamente os deals fechados no mês.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { computeConfidence } from "../_shared/reportConfidence.ts";
import {
  okResponse,
  errResponse,
  preflight,
} from "../_shared/reportResponse.ts";

const REPORT_KEY = "summary_v2";
const SOURCE_VIEW = "v_reporting_opportunities_v2";

interface ReportingOppRow {
  opportunity_id: string;
  pipeline_id: string | null;
  owner_user_id: string | null;
  qualified_by_user_id: string | null;
  status: string | null;
  net_revenue_final: number | null;
  commercial_amount_current: number | null;
  closed_at: string | null;
  created_at: string | null;
  origin_name: string | null;
  stage_id: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const parsed = await parseReportRequest(req);
  if (!parsed.ok) {
    return errResponse({
      reportKey: REPORT_KEY,
      code: "BAD_REQUEST",
      message: parsed.error,
      status: 400,
    });
  }
  const { organizationId, filters } = parsed.value;

  const auth = await authorize(req, organizationId);
  if (!auth.ok) {
    return errResponse({
      reportKey: REPORT_KEY,
      organizationId,
      code: auth.code,
      message: auth.message,
      status: auth.status,
    });
  }

  const sb = serviceClient();
  const t0 = Date.now();

  // Build base query — sales pipelines only.
  let q = sb
    .from(SOURCE_VIEW)
    .select(
      "opportunity_id,pipeline_id,owner_user_id,qualified_by_user_id,status,net_revenue_final,commercial_amount_current,closed_at,created_at,origin_name,stage_id",
    )
    .eq("organization_id", organizationId)
    .eq("pipeline_type", "sales");

  // Period filter: prefer closed_at for won/lost semantics.
  // Open deals (active pipeline) are NEVER period-filtered — always current snapshot.
  // We split into two queries to handle this correctly.
  const start = filters?.dateRange?.start ?? null;
  const end = filters?.dateRange?.end ?? null;

  // Apply non-period dimensional filters to BOTH queries.
  const applyDims = (query: any) => {
    let qq = query;
    if (filters?.pipelineIds?.length) qq = qq.in("pipeline_id", filters.pipelineIds);
    if (filters?.ownerUserIds?.length) qq = qq.in("owner_user_id", filters.ownerUserIds);
    if (filters?.qualifiedByUserIds?.length) qq = qq.in("qualified_by_user_id", filters.qualifiedByUserIds);
    if (filters?.originNames?.length) qq = qq.in("origin_name", filters.originNames);
    if (filters?.stageIds?.length) qq = qq.in("stage_id", filters.stageIds);
    if (
      filters?.teamVisibility?.enabled &&
      Array.isArray(filters?.teamVisibility?.visibleUserIds) &&
      filters.teamVisibility.visibleUserIds.length > 0
    ) {
      qq = qq.in("owner_user_id", filters.teamVisibility.visibleUserIds);
    }
    return qq;
  };

  // Active pipeline (current snapshot, no period filter)
  let activeQ = applyDims(
    sb
      .from(SOURCE_VIEW)
      .select("opportunity_id,commercial_amount_current,status")
      .eq("organization_id", organizationId)
      .eq("pipeline_type", "sales")
      .not("status", "in", "(won,lost)"),
  );

  // Won/lost in period (filter by closed_at when range provided)
  let processedQ = applyDims(
    sb
      .from(SOURCE_VIEW)
      .select("status,net_revenue_final,commercial_amount_current,closed_at")
      .eq("organization_id", organizationId)
      .eq("pipeline_type", "sales")
      .in("status", ["won", "lost"]),
  );
  if (start) processedQ = processedQ.gte("closed_at", start);
  if (end) processedQ = processedQ.lte("closed_at", end);

  // Supabase default range is 1000 — explicitly raise.
  const [activeRes, processedRes] = await Promise.all([
    activeQ.range(0, 49999),
    processedQ.range(0, 49999),
  ]);

  if (activeRes.error) {
    return errResponse({
      reportKey: REPORT_KEY,
      organizationId,
      code: "QUERY_FAILED",
      message: `active: ${activeRes.error.message}`,
      status: 500,
    });
  }
  if (processedRes.error) {
    return errResponse({
      reportKey: REPORT_KEY,
      organizationId,
      code: "QUERY_FAILED",
      message: `processed: ${processedRes.error.message}`,
      status: 500,
    });
  }

  const active = activeRes.data ?? [];
  const processed = processedRes.data ?? [];

  let wonCount = 0;
  let wonRevenue = 0;
  let lostCount = 0;
  let lostValue = 0;
  for (const row of processed as any[]) {
    if (row.status === "won") {
      wonCount++;
      wonRevenue += Number(row.net_revenue_final ?? 0);
    } else if (row.status === "lost") {
      lostCount++;
      lostValue += Number(row.commercial_amount_current ?? 0);
    }
  }

  const activePipelineCount = active.length;
  const activePipelineValue = (active as any[]).reduce(
    (s, r) => s + Number(r.commercial_amount_current ?? 0),
    0,
  );
  const processedCount = wonCount + lostCount;
  const winRatePct = processedCount > 0
    ? Math.round((wonCount / processedCount) * 10000) / 100
    : null;
  const avgWonTicket = wonCount > 0
    ? Math.round((wonRevenue / wonCount) * 100) / 100
    : 0;

  const summary = {
    organization_id: organizationId,
    active_pipeline_count: activePipelineCount,
    active_pipeline_value: activePipelineValue,
    won_count: wonCount,
    won_revenue: wonRevenue,
    lost_count: lostCount,
    lost_value: lostValue,
    processed_count: processedCount,
    win_rate_pct: winRatePct,
    avg_won_ticket: avgWonTicket,
  };

  const confidence = await computeConfidence(sb, organizationId, {
    monetary: true,
    history: true,
  });

  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: summary,
    filtersApplied: filters,
    confidence,
    rowCount: 1,
    debug: auth.canDebug
      ? {
        view: SOURCE_VIEW,
        durationMs: Date.now() - t0,
        activeRows: active.length,
        processedRows: processed.length,
        usedDateColumn: "closed_at",
      }
      : undefined,
  });
});
