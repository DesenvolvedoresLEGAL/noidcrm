// Sprint C: Aggregates prospect/enrichment signals into org-wide learning_signals
// when terminal events (replied / meeting / won / lost) occur.
//
// Protections:
//  - occurrences < 20  -> impact_score = 0  (avoid bias)
//  - impact_score      -> clamped to [-20, +20]
//  - confidence        -> min(occurrences / 100, 1.0)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MIN_OCCURRENCES_FOR_IMPACT = 20;
const IMPACT_CAP = 20;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      organization_id,
      prospect_id = null,
      opportunity_id = null,
      outcome,
      weight = 1,
    } = await req.json();

    if (!organization_id || !outcome) {
      return jsonResponse({ error: "organization_id and outcome required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve prospect_id from opportunity if needed
    let resolvedProspectId = prospect_id;
    if (!resolvedProspectId && opportunity_id) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("prospect_id")
        .eq("id", opportunity_id)
        .maybeSingle();
      resolvedProspectId = (opp as any)?.prospect_id ?? null;
    }

    // Collect signals from both prospect_signals and enrichment_signals
    const signals: Array<{ signal_type: string; signal_value: string }> = [];

    if (resolvedProspectId) {
      const { data: ps } = await supabase
        .from("prospect_signals")
        .select("signal_type, signal_value")
        .eq("organization_id", organization_id)
        .eq("prospect_id", resolvedProspectId);
      (ps ?? []).forEach((s: any) => signals.push(s));

      const { data: es } = await supabase
        .from("enrichment_signals")
        .select("signal_type, signal_value")
        .eq("workspace_id", organization_id)
        .eq("prospect_id", resolvedProspectId);
      (es ?? []).forEach((s: any) => signals.push(s));
    }

    if (signals.length === 0) {
      return jsonResponse({ status: "no_signals", processed: 0 });
    }

    let processed = 0;
    for (const s of signals) {
      if (!s.signal_type || !s.signal_value) continue;

      // Upsert row, then read+update for impact calculation
      await supabase.from("learning_signals").upsert(
        {
          organization_id,
          signal_type: s.signal_type,
          signal_value: s.signal_value,
        },
        { onConflict: "organization_id,signal_type,signal_value", ignoreDuplicates: true },
      );

      const { data: current } = await supabase
        .from("learning_signals")
        .select("id, occurrences, positive_outcomes, negative_outcomes")
        .eq("organization_id", organization_id)
        .eq("signal_type", s.signal_type)
        .eq("signal_value", s.signal_value)
        .single();

      if (!current) continue;

      const occurrences = (current.occurrences ?? 0) + 1;
      const positive =
        (current.positive_outcomes ?? 0) + (outcome === "positive" ? weight : 0);
      const negative =
        (current.negative_outcomes ?? 0) + (outcome === "negative" ? weight : 0);

      let impact = 0;
      if (occurrences >= MIN_OCCURRENCES_FOR_IMPACT) {
        const ratio = (positive - negative) / occurrences;
        impact = clamp(ratio * 30, -IMPACT_CAP, IMPACT_CAP);
      }
      const confidence = Math.min(occurrences / 100, 1);

      await supabase
        .from("learning_signals")
        .update({
          occurrences,
          positive_outcomes: positive,
          negative_outcomes: negative,
          impact_score: Number(impact.toFixed(2)),
          confidence: Number(confidence.toFixed(3)),
          last_recalculated_at: new Date().toISOString(),
        })
        .eq("id", current.id);

      processed++;
    }

    return jsonResponse({ status: "ok", processed, total_signals: signals.length });
  } catch (err) {
    console.error("[update-learning-signals] unhandled:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
