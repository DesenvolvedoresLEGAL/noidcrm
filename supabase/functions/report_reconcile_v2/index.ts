import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { okResponse, errResponse, preflight } from "../_shared/reportResponse.ts";

const REPORT_KEY = "reconcile_v2";

// Tolerances per metric type.
const TOL_MONETARY = 0.01;
const TOL_PCT = 0.05;
const TOL_COUNT = 0;

type Severity = "info" | "warning" | "critical";
type CheckType = "monetary" | "pct" | "count";

interface Check {
  key: string;
  description: string;
  type: CheckType;
  expected: number;
  actual: number;
  delta: number;
  tolerance: number;
  isConsistent: boolean;
  severity: Severity;
}

function evaluate(
  key: string,
  description: string,
  type: CheckType,
  expected: number | null | undefined,
  actual: number | null | undefined,
  criticalSeverity: "warning" | "critical" = "warning",
): Check {
  const e = Number(expected ?? 0);
  const a = Number(actual ?? 0);
  const delta = a - e;
  const absDelta = Math.abs(delta);
  const tolerance = type === "monetary" ? TOL_MONETARY : type === "pct" ? TOL_PCT : TOL_COUNT;
  const isConsistent = absDelta <= tolerance;
  let severity: Severity = "info";
  if (!isConsistent) {
    // 10x tolerance → critical bump for criticalSeverity callers
    severity = absDelta > tolerance * 10 ? criticalSeverity : "warning";
  }
  return { key, description, type, expected: e, actual: a, delta, tolerance, isConsistent, severity };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const parsed = await parseReportRequest(req);
  if (!parsed.ok) {
    return errResponse({ reportKey: REPORT_KEY, code: "BAD_REQUEST", message: parsed.error, status: 400 });
  }
  const { organizationId, options } = parsed.value as { organizationId: string; options?: { persist?: boolean } };
  const persist = Boolean(options?.persist);

  const auth = await authorize(req, organizationId);
  if (!auth.ok) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: auth.code, message: auth.message, status: auth.status });
  }

  const sb = serviceClient();
  const t0 = Date.now();

  // Parallel fetch of all source views.
  // Sprint 2.11 — adicionada v_unified_won_revenue_v2 (CEO Dashboard ↔ Reports).
  const [
    summaryRes,
    processedRes,
    forecastRes,
    closerRes,
    lossesRes,
    teamRes,
    originsRes,
    stageBalRes,
    unifiedRes,
  ] = await Promise.all([
    sb.from("v_report_summary_v2").select("*").eq("organization_id", organizationId).maybeSingle(),
    sb.from("v_report_processed_v2").select("*").eq("organization_id", organizationId).maybeSingle(),
    sb.from("v_report_forecast_v2").select("*").eq("organization_id", organizationId).maybeSingle(),
    sb.from("v_report_closer_v2").select("won_revenue, won_count").eq("organization_id", organizationId),
    sb.from("v_report_losses_v2").select("lost_count, lost_value").eq("organization_id", organizationId),
    sb.from("v_report_team_v2").select("won_revenue, won_count").eq("organization_id", organizationId),
    sb.from("v_report_origins_v2").select("won_revenue, won_count").eq("organization_id", organizationId),
    sb.from("v_report_stage_balance_v2").select("active_value, active_count").eq("organization_id", organizationId),
    sb.from("v_unified_won_revenue_v2").select("won_revenue, won_count").eq("organization_id", organizationId).maybeSingle(),
  ]);

  const firstError = [summaryRes, processedRes, forecastRes, closerRes, lossesRes, teamRes, originsRes, stageBalRes, unifiedRes]
    .find((r) => r.error);
  if (firstError?.error) {
    return errResponse({
      reportKey: REPORT_KEY,
      organizationId,
      code: "QUERY_FAILED",
      message: firstError.error.message,
      status: 500,
    });
  }

  const summary = (summaryRes.data ?? {}) as Record<string, number | null>;
  const processed = (processedRes.data ?? {}) as Record<string, number | null>;
  const forecast = (forecastRes.data ?? {}) as Record<string, number | null>;
  const unified = (unifiedRes.data ?? {}) as Record<string, number | null>;

  const sumNum = <T extends Record<string, unknown>>(rows: T[] | null, key: string) =>
    (rows ?? []).reduce((acc, r) => acc + Number((r as Record<string, unknown>)[key] ?? 0), 0);

  const closerRevSum  = sumNum(closerRes.data as Record<string, unknown>[], "won_revenue");
  const lossesCntSum  = sumNum(lossesRes.data as Record<string, unknown>[], "lost_count");
  const lossesValSum  = sumNum(lossesRes.data as Record<string, unknown>[], "lost_value");
  const teamRevSum    = sumNum(teamRes.data as Record<string, unknown>[], "won_revenue");
  const teamCntSum    = sumNum(teamRes.data as Record<string, unknown>[], "won_count");
  const originsRevSum = sumNum(originsRes.data as Record<string, unknown>[], "won_revenue");
  const originsCntSum = sumNum(originsRes.data as Record<string, unknown>[], "won_count");
  const stageBalValSum = sumNum(stageBalRes.data as Record<string, unknown>[], "active_value");
  const stageBalCntSum = sumNum(stageBalRes.data as Record<string, unknown>[], "active_count");

  // 12 reconcile checks (Sprint 2.9 spec).
  const checks: Check[] = [
    evaluate("summary_won_revenue_vs_closer", "summary.won_revenue ≈ Σ closer.won_revenue",
      "monetary", summary.won_revenue, closerRevSum, "critical"),
    evaluate("summary_won_revenue_vs_forecast", "summary.won_revenue ≈ forecast.closed_revenue",
      "monetary", summary.won_revenue, forecast.closed_revenue, "critical"),
    evaluate("summary_lost_count_vs_losses", "summary.lost_count ≈ Σ losses.lost_count",
      "count", summary.lost_count, lossesCntSum, "warning"),
    evaluate("summary_processed_vs_processed", "summary.processed_count ≈ processed.processed_count",
      "count", summary.processed_count, processed.processed_count, "warning"),
    evaluate("summary_winrate_vs_processed", "summary.win_rate_pct ≈ processed.win_rate_pct",
      "pct", summary.win_rate_pct, processed.win_rate_pct, "warning"),
    evaluate("team_revenue_vs_summary", "Σ team.won_revenue ≈ summary.won_revenue",
      "monetary", teamRevSum, summary.won_revenue, "critical"),
    evaluate("origins_revenue_vs_summary", "Σ origins.won_revenue ≈ summary.won_revenue",
      "monetary", originsRevSum, summary.won_revenue, "critical"),
    evaluate("team_count_vs_summary", "Σ team.won_count ≈ summary.won_count",
      "count", teamCntSum, summary.won_count, "warning"),
    evaluate("origins_count_vs_summary", "Σ origins.won_count ≈ summary.won_count",
      "count", originsCntSum, summary.won_count, "warning"),
    evaluate("losses_value_vs_summary", "Σ losses.lost_value ≈ summary.lost_value",
      "monetary", lossesValSum, summary.lost_value, "warning"),
    evaluate("stage_balance_value_vs_summary", "Σ stage_balance.active_value ≈ summary.active_pipeline_value",
      "monetary", stageBalValSum, summary.active_pipeline_value, "warning"),
    evaluate("stage_balance_count_vs_summary", "Σ stage_balance.active_count ≈ summary.active_pipeline_count",
      "count", stageBalCntSum, summary.active_pipeline_count, "warning"),
    // Sprint 2.11 — 13º check: garante que CEO Dashboard e Reports V2 mostrem o mesmo valor.
    evaluate("unified_won_revenue_vs_summary", "v_unified_won_revenue_v2.won_revenue ≈ summary.won_revenue (CEO ↔ Reports)",
      "monetary", unified.won_revenue, summary.won_revenue, "critical"),
    evaluate("unified_won_count_vs_summary", "v_unified_won_revenue_v2.won_count ≈ summary.won_count (CEO ↔ Reports)",
      "count", unified.won_count, summary.won_count, "critical"),
  ];

  const hasCritical = checks.some((c) => !c.isConsistent && c.severity === "critical");
  const hasWarning  = checks.some((c) => !c.isConsistent && c.severity === "warning");
  const overallStatus: "consistent" | "warning" | "critical" =
    hasCritical ? "critical" : hasWarning ? "warning" : "consistent";

  // Opt-in persistence (default off — avoids polluting logs on UI refreshes).
  if (persist) {
    try {
      const rows = checks.map((c) => ({
        organization_id: organizationId,
        report_key: REPORT_KEY,
        check_key: c.key,
        expected_value: c.expected,
        actual_value: c.actual,
        delta_value: c.delta,
        is_consistent: c.isConsistent,
        severity: c.severity,
        metadata: { description: c.description, type: c.type, tolerance: c.tolerance },
      }));
      await sb.from("report_reconciliation_logs").insert(rows);
    } catch (logErr) {
      console.error("[report_reconcile_v2] failed to log:", logErr);
    }
  }

  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: { checks, overallStatus, persisted: persist },
    rowCount: checks.length,
    debug: auth.canDebug
      ? { durationMs: Date.now() - t0, closerRevSum, teamRevSum, originsRevSum, lossesValSum, stageBalValSum }
      : undefined,
  });
});
