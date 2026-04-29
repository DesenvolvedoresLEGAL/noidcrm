// Sprint E — Evaluate running experiments: aggregate per-variant metrics,
// pick winner if min sample size + min lift over control are met.
// On winner found: complete hypothesis and create an optimization_recommendation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function score(reply: number, meeting: number, win: number): number {
  return win * 0.6 + meeting * 0.3 + reply * 0.1;
}

async function evalHypothesis(admin: any, hyp: any) {
  const { data: gr } = await admin.from("agent_guardrails").select("*").eq("organization_id", hyp.organization_id).maybeSingle();
  const minSample = Math.max(5, gr?.min_sample_size ?? 20);
  const minLift = Math.max(0, gr?.min_lift_to_promote ?? 0.10);

  const { data: variants } = await admin.from("experiment_variants").select("id, is_control, variant_label").eq("hypothesis_id", hyp.id);
  if (!variants || variants.length === 0) return { hypothesis_id: hyp.id, skipped: "no_variants" };

  const { data: runs } = await admin
    .from("experiment_runs")
    .select("variant_id, result, result_event")
    .eq("hypothesis_id", hyp.id);

  const agg = new Map<string, { sent: number; replies: number; meetings: number; wins: number }>();
  for (const v of variants) agg.set(v.id, { sent: 0, replies: 0, meetings: 0, wins: 0 });
  for (const r of runs ?? []) {
    const a = agg.get(r.variant_id);
    if (!a) continue;
    a.sent += 1;
    if (r.result_event === "reply") a.replies += 1;
    if (r.result_event === "meeting") a.meetings += 1;
    if (r.result_event === "win") a.wins += 1;
  }

  const computed = variants.map((v: any) => {
    const a = agg.get(v.id)!;
    const reply_rate = a.sent ? a.replies / a.sent : 0;
    const meeting_rate = a.sent ? a.meetings / a.sent : 0;
    const win_rate = a.sent ? a.wins / a.sent : 0;
    return {
      organization_id: hyp.organization_id,
      hypothesis_id: hyp.id,
      variant_id: v.id,
      is_control: v.is_control,
      sent: a.sent,
      replies: a.replies,
      meetings: a.meetings,
      wins: a.wins,
      reply_rate,
      meeting_rate,
      win_rate,
      score: score(reply_rate, meeting_rate, win_rate),
      sample_size: a.sent,
      statistical_confidence: 0,
    };
  });

  // Upsert results
  for (const row of computed) {
    const { is_control, ...payload } = row as any;
    await admin.from("experiment_results").upsert(payload as any, { onConflict: "hypothesis_id,variant_id" });
  }

  const minSampleAcrossVariants = Math.min(...computed.map((c) => c.sample_size));
  if (minSampleAcrossVariants < minSample) {
    return { hypothesis_id: hyp.id, status: "insufficient_sample", min: minSampleAcrossVariants };
  }

  const control = computed.find((c) => c.is_control) ?? computed[0];
  const challengers = computed.filter((c) => c.variant_id !== control.variant_id);
  let winner = control;
  for (const c of challengers) {
    if (c.score > winner.score) winner = c;
  }
  const lift = control.score > 0 ? (winner.score - control.score) / control.score : (winner.score > 0 ? 1 : 0);

  if (winner.variant_id === control.variant_id || lift < minLift) {
    return { hypothesis_id: hyp.id, status: "no_clear_winner", lift };
  }

  // Mark hypothesis completed + create recommendation
  await admin
    .from("experiment_hypotheses")
    .update({ status: "completed", winner_variant_id: winner.variant_id, completed_at: new Date().toISOString() })
    .eq("id", hyp.id);

  const recType = hyp.hypothesis_type === "template" ? "template_change"
    : hyp.hypothesis_type === "channel" ? "channel_shift"
    : hyp.hypothesis_type === "timing" ? "playbook_change"
    : "rule_change";

  await admin.from("optimization_recommendations").insert({
    organization_id: hyp.organization_id,
    insight_id: hyp.source_insight_id,
    recommendation_type: recType,
    target_type: hyp.target_entity,
    target_id: hyp.target_id,
    title: `Promover variante vencedora do experimento`,
    description: `Variante venceu por ${(lift * 100).toFixed(1)}% de lift sobre o controle (amostra ${minSampleAcrossVariants}/variante).`,
    impact_estimate: lift,
    confidence_score: Math.min(0.99, 0.6 + lift),
    action_payload: {
      hypothesis_id: hyp.id,
      winner_variant_id: winner.variant_id,
      target_entity: hyp.target_entity,
      target_id: hyp.target_id,
      lift,
      promote_via: "promote-winning-variant",
    },
    status: "pending",
  });

  return { hypothesis_id: hyp.id, status: "winner_found", winner: winner.variant_id, lift };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetHyp = body?.hypothesis_id as string | undefined;
    const targetOrg = body?.organization_id as string | undefined;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let q = admin.from("experiment_hypotheses").select("*").eq("status", "running").is("deleted_at", null);
    if (targetHyp) q = q.eq("id", targetHyp);
    if (targetOrg) q = q.eq("organization_id", targetOrg);

    const { data: hyps, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const h of hyps ?? []) results.push(await evalHypothesis(admin, h));

    return new Response(JSON.stringify({ ok: true, evaluated: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[evaluate-experiment] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
