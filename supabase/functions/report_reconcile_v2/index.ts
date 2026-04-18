import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { okResponse, errResponse, preflight } from "../_shared/reportResponse.ts";

const REPORT_KEY = "reconcile_v2";
const TOLERANCE = 0.01; // 1% delta tolerance for monetary checks

interface Check {
  key: string;
  description: string;
  expected: number;
  actual: number;
  delta: number;
  isConsistent: boolean;
  severity: "info" | "warning" | "critical";
}

function pctDelta(expected: number, actual: number): number {
  const denom = Math.max(Math.abs(expected), Math.abs(actual), 1);
  return Math.abs(expected - actual) / denom;
}

function evaluate(
  key: string,
  description: string,
  expected: number | null | undefined,
  actual: number | null | undefined,
  tolerance = TOLERANCE,
  criticalSeverity: "warning" | "critical" = "warning",
): Check {
  const e = Number(expected ?? 0);
  const a = Number(actual ?? 0);
  const delta = a - e;
  const ratio = pctDelta(e, a);
  const isConsistent = ratio <= tolerance;
  let severity: "info" | "warning" | "critical" = "info";
  if (!isConsistent) severity = ratio > 0.1 ? criticalSeverity : "warning";
  return { key, description, expected: e, actual: a, delta, isConsistent, severity };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const parsed = await parseReportRequest(req);
  if (!parsed.ok) {
    return errResponse({ reportKey: REPORT_KEY, code: "BAD_REQUEST", message: parsed.error, status: 400 });
  }
  const { organizationId } = parsed.value;
  const auth = await authorize(req, organizationId);
  if (!auth.ok) {
    return errResponse({ reportKey: REPORT_KEY, organizationId, code: auth.code, message: auth.message, status: auth.status });
  }

  const sb = serviceClient();
  const t0 = Date.now();

  // Parallel fetch of all source views.
  const [summaryRes, processedRes, forecastRes, closerRes, lossesRes] = await Promise.all([
    sb.from("v_report_summary_v2").select("*").eq("organization_id", organizationId).maybeSingle(),
    sb.from("v_report_processed_v2").select("*").eq("organization_id", organizationId).maybeSingle(),
    sb.from("v_report_forecast_v2").select("*").eq("organization_id", organizationId).maybeSingle(),
    sb.from("v_report_closer_v2").select("won_revenue").eq("organization_id", organizationId),
    sb.from("v_report_losses_v2").select("lost_count").eq("organization_id", organizationId),
  ]);

  const firstError = [summaryRes, processedRes, forecastRes, closerRes, lossesRes].find((r) => r.error);
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
  const closerSum = (closerRes.data ?? []).reduce(
    (acc: number, r: { won_revenue?: number | null }) => acc + Number(r.won_revenue ?? 0),
    0,
  );
  const lossesSum = (lossesRes.data ?? []).reduce(
    (acc: number, r: { lost_count?: number | null }) => acc + Number(r.lost_count ?? 0),
    0,
  );

  const checks: Check[] = [
    evaluate("summary_won_revenue_vs_closer", "summary.won_revenue ≈ Σ closer.won_revenue",
      summary.won_revenue, closerSum, TOLERANCE, "critical"),
    evaluate("summary_won_revenue_vs_forecast", "summary.won_revenue ≈ forecast.closed_revenue",
      summary.won_revenue, forecast.closed_revenue, TOLERANCE, "critical"),
    evaluate("summary_lost_count_vs_losses", "summary.lost_count ≈ Σ losses.lost_count",
      summary.lost_count, lossesSum, 0, "warning"),
    evaluate("summary_processed_vs_processed", "summary.processed_count ≈ processed.processed_count",
      summary.processed_count, processed.processed_count, 0, "warning"),
    evaluate("summary_winrate_vs_processed", "summary.win_rate_pct ≈ processed.win_rate_pct",
      summary.win_rate_pct, processed.win_rate_pct, 0.01, "warning"),
  ];

  const hasCritical = checks.some((c) => !c.isConsistent && c.severity === "critical");
  const hasWarning = checks.some((c) => !c.isConsistent && c.severity === "warning");
  const overallStatus: "consistent" | "warning" | "critical" =
    hasCritical ? "critical" : hasWarning ? "warning" : "consistent";

  // Best-effort write to reconciliation_logs.
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
      metadata: { description: c.description },
    }));
    await sb.from("report_reconciliation_logs").insert(rows);
  } catch (logErr) {
    console.error("[report_reconcile_v2] failed to log:", logErr);
  }

  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: { checks, overallStatus },
    rowCount: checks.length,
    debug: auth.canDebug ? { durationMs: Date.now() - t0, closerSum, lossesSum } : undefined,
  });
});
