// Sprint D — Daily orchestrator: compute → generate → (auto)apply
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Auto-apply só roda em recomendações com confiança >= esse limite
const AUTO_APPLY_MIN_CONFIDENCE = 0.8;
// Limite de auto-applies por org por ciclo (defesa contra "auto-caos")
const MAX_AUTO_APPLIES_PER_ORG = 5;

async function invokeFn(path: string, body: unknown) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await resp.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch (_) { /* */ }
  return { ok: resp.ok, status: resp.status, body: parsed ?? text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  const summary: any = { started_at: startedAt, steps: {} };

  try {
    // 1. Compute insights (todas as orgs)
    summary.steps.compute = await invokeFn("compute-optimization-insights", {});

    // 2. Generate recommendations (todas as orgs)
    summary.steps.generate = await invokeFn("generate-recommendations", {});

    // 2.1 Sprint E — Generate experiment hypotheses & evaluate running ones
    summary.steps.generate_hypotheses = await invokeFn("generate-experiment-hypothesis", {});
    summary.steps.evaluate_experiments = await invokeFn("evaluate-experiment", {});

    // 3. Auto-apply: somente onde auto-mode está ON
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: orgs, error: orgsErr } = await admin
      .from("organizations")
      .select("id, settings")
      .neq("status", "deleted");
    if (orgsErr) throw orgsErr;

    const autoOrgs = (orgs ?? []).filter((o: any) => Boolean(o.settings?.optimization_auto_mode));
    summary.auto_mode_orgs = autoOrgs.length;
    summary.steps.auto_apply = [];

    for (const org of autoOrgs) {
      const { data: pending, error: pErr } = await admin
        .from("optimization_recommendations")
        .select("id, confidence_score, impact_estimate")
        .eq("organization_id", org.id)
        .eq("status", "pending")
        .gte("confidence_score", AUTO_APPLY_MIN_CONFIDENCE)
        .order("confidence_score", { ascending: false })
        .limit(MAX_AUTO_APPLIES_PER_ORG);
      if (pErr) {
        console.error("[orchestrator] pending fetch error", org.id, pErr.message);
        continue;
      }

      const results: any[] = [];
      for (const rec of pending ?? []) {
        const r = await invokeFn("apply-recommendation", { recommendation_id: rec.id, auto: true });
        results.push({ recommendation_id: rec.id, ok: r.ok, status: r.status });
      }
      summary.steps.auto_apply.push({ organization_id: org.id, applied: results.length, results });
    }

    summary.finished_at = new Date().toISOString();
    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[run-optimization-cycle] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
