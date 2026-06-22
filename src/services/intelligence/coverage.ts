import { supabase } from "@/integrations/supabase/client";

export type CoverageClass = "complete" | "good" | "partial" | "weak" | "new";

export interface CoverageFlags {
  account_exists: boolean;
  contact_status: "none" | "partial" | "complete";
  decision_maker_status: "found" | "partial" | "absent";
  phone_exists: boolean;
  whatsapp_status: "ready" | "unknown";
  opportunity_status: "open" | "won" | "lost" | "none";
  proposal_status: "sent" | "viewed" | "accepted" | "declined" | "none";
  customer_status: "active" | "former" | "never";
}

export interface CoverageAnalysis {
  score: number;
  class: CoverageClass;
  missing: string[];
  recommendations: string[];
  next_best_action: string | null;
  apollo_blocked: boolean;
  analysis_id: string | null;
  account_id: string | null;
  flags: CoverageFlags;
}

export async function analyzeCoverage(
  prospectId: string,
  forceRefresh = false,
): Promise<CoverageAnalysis> {
  const { data, error } = await supabase.functions.invoke("kairos-analyze-coverage", {
    body: { prospect_id: prospectId, force_refresh: forceRefresh },
  });
  if (error) throw error;
  return data as CoverageAnalysis;
}

export async function getLatestCoverage(prospectId: string): Promise<CoverageAnalysis | null> {
  const { data, error } = await (supabase as any)
    .from("kairos_coverage_analysis")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    score: data.coverage_score,
    class: data.coverage_class,
    missing: data.missing_items ?? [],
    recommendations: data.recommendations ?? [],
    next_best_action: data.next_best_action,
    apollo_blocked: data.apollo_blocked,
    analysis_id: data.id,
    account_id: data.account_id,
    flags: {
      account_exists: data.account_exists,
      contact_status: data.contact_status,
      decision_maker_status: data.decision_maker_status,
      phone_exists: data.phone_exists,
      whatsapp_status: data.whatsapp_status,
      opportunity_status: data.opportunity_status,
      proposal_status: data.proposal_status,
      customer_status: data.customer_status,
    },
  };
}

export const COVERAGE_CLASS_LABELS: Record<CoverageClass, string> = {
  complete: "Cobertura Completa",
  good: "Cobertura Boa",
  partial: "Cobertura Parcial",
  weak: "Cobertura Fraca",
  new: "Conta Nova",
};

export const COVERAGE_CLASS_COLOR: Record<CoverageClass, string> = {
  complete: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  good: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  partial: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  weak: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300",
  new: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300",
};
