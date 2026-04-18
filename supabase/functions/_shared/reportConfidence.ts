// Sprint 2.6 — Confidence score computation for V2 reports.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ConfidenceLevel = "high" | "medium" | "low" | "partial" | "unavailable";

export interface ReportConfidence {
  level: ConfidenceLevel;
  score: number; // 0-100
  breakdown: Record<string, number | null>;
}

export interface ConfidenceFlags {
  monetary?: boolean;
  history?: boolean;
  loss?: boolean;
  /** Custom score 0-100 to merge into the average. */
  custom?: { key: string; score: number } | null;
}

function levelFromScore(score: number | null): ConfidenceLevel {
  if (score === null || Number.isNaN(score)) return "unavailable";
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

async function readCoverageScore(
  sb: SupabaseClient,
  orgId: string,
  view: string,
  scoreColumn: string,
): Promise<number | null> {
  // deno-lint-ignore no-explicit-any
  const { data, error } = await (sb as any)
    .from(view)
    .select(scoreColumn)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as Record<string, unknown>)[scoreColumn];
  const num = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(num) ? num : null;
}

export async function computeConfidence(
  sb: SupabaseClient,
  organizationId: string,
  flags: ConfidenceFlags = {},
): Promise<ReportConfidence> {
  const breakdown: Record<string, number | null> = {};

  if (flags.monetary) {
    breakdown.monetary = await readCoverageScore(
      sb,
      organizationId,
      "v_opportunity_amount_coverage_v2",
      "coverage_pct",
    );
  }
  if (flags.history) {
    breakdown.history = await readCoverageScore(
      sb,
      organizationId,
      "v_opportunity_history_coverage_v2",
      "coverage_pct",
    );
  }
  if (flags.loss) {
    breakdown.loss = await readCoverageScore(
      sb,
      organizationId,
      "v_loss_classification_coverage_v2",
      "coverage_pct",
    );
  }
  if (flags.custom) {
    breakdown[flags.custom.key] = flags.custom.score;
  }

  const values = Object.values(breakdown).filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v),
  );

  if (values.length === 0) {
    return { level: "unavailable", score: 0, breakdown };
  }

  const score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { level: levelFromScore(score), score, breakdown };
}
