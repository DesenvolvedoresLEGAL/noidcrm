import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseReportRequest } from "../_shared/reportRequest.ts";
import { authorize } from "../_shared/reportAuth.ts";
import { serviceClient } from "../_shared/reportClient.ts";
import { okResponse, errResponse, preflight } from "../_shared/reportResponse.ts";

const REPORT_KEY = "health_v2";

interface ReadinessRow {
  report_key: string;
  readiness_status: string;
  readiness_score: number;
  reconcile_consistent: boolean;
  reconcile_severity: string;
  last_check_at: string | null;
  reasons: Record<string, unknown>;
}

interface ConfidenceRow {
  proposal_based_coverage_pct: number;
  stage_history_coverage_pct: number;
  owner_history_coverage_pct: number;
  qualification_history_coverage_pct: number;
  loss_complete_coverage_pct: number;
  loss_any_coverage_pct: number;
  overall_confidence_score: number;
}

function buildWarnings(conf: ConfidenceRow | null, readiness: ReadinessRow[]): string[] {
  const w: string[] = [];
  if (!conf || (conf.overall_confidence_score ?? 0) < 55) {
    w.push("Confiança global baixa (<55). Priorize melhorar cobertura monetária e histórica.");
  } else if ((conf.overall_confidence_score ?? 0) < 75) {
    w.push("Confiança parcial (55-74). Algumas abas ainda não estão prontas para v2_only.");
  }
  if (conf && conf.proposal_based_coverage_pct < 60) {
    w.push("Cobertura monetária por proposta abaixo de 60% — receita pode estar subestimada.");
  }
  if (conf && conf.qualification_history_coverage_pct < 50) {
    w.push("Histórico de qualificação <50% — métricas de SDR/Handoff podem estar parciais.");
  }
  if (conf && conf.stage_history_coverage_pct < 50) {
    w.push("Histórico de etapas <50% — Funil/Conversão podem estar parciais.");
  }
  const notReady = readiness.filter((r) => r.readiness_status === "not_ready").map((r) => r.report_key);
  if (notReady.length > 0) {
    w.push(`Abas ainda não prontas para v2_only: ${notReady.join(", ")}.`);
  }
  return w;
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

  const [confRes, readinessRes, reconcileRes] = await Promise.all([
    sb.from("v_report_confidence_score_v2").select("*").eq("organization_id", organizationId).maybeSingle(),
    sb.from("v_report_legacy_retirement_readiness_v2").select("*").eq("organization_id", organizationId),
    sb.functions.invoke("report_reconcile_v2", { body: { organizationId, options: { persist: false } } }),
  ]);

  if (confRes.error) {
    return errResponse({
      reportKey: REPORT_KEY,
      organizationId,
      code: "QUERY_FAILED",
      message: confRes.error.message,
      status: 500,
    });
  }
  if (readinessRes.error) {
    return errResponse({
      reportKey: REPORT_KEY,
      organizationId,
      code: "QUERY_FAILED",
      message: readinessRes.error.message,
      status: 500,
    });
  }

  const confidence = (confRes.data ?? null) as ConfidenceRow | null;
  const readiness = (readinessRes.data ?? []) as ReadinessRow[];
  const reconcilePayload = reconcileRes.data as { data?: { checks?: unknown[]; overallStatus?: string } } | null;
  const reconcile = reconcilePayload?.data ?? { checks: [], overallStatus: "unknown" };

  const warnings = buildWarnings(confidence, readiness);

  return okResponse({
    reportKey: REPORT_KEY,
    organizationId,
    data: {
      confidence,
      coverage: confidence
        ? {
            monetary: confidence.proposal_based_coverage_pct,
            stage_history: confidence.stage_history_coverage_pct,
            owner_history: confidence.owner_history_coverage_pct,
            qualification_history: confidence.qualification_history_coverage_pct,
            loss_complete: confidence.loss_complete_coverage_pct,
            loss_any: confidence.loss_any_coverage_pct,
          }
        : null,
      reconcile,
      readiness,
      warnings,
    },
    rowCount: readiness.length,
    debug: auth.canDebug ? { durationMs: Date.now() - t0 } : undefined,
  });
});
