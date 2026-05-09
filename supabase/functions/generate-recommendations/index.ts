// Sprint D — Generate recommendations from optimization insights
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_SCORE_ADJUST = 10;

function buildRecFromInsight(insight: any) {
  const orgId = insight.organization_id;
  const conf = Number(insight.confidence_score ?? 0);
  const delta = Number(insight.delta ?? 0);

  if (insight.insight_type === "signal" && delta > 0) {
    const points = Math.min(MAX_SCORE_ADJUST, Math.max(2, Math.round(delta * 30)));
    const [signal_type, signal_value] = String(insight.entity_id ?? "").split("::");
    return {
      organization_id: orgId,
      insight_id: insight.id,
      recommendation_type: "score_adjustment",
      target_type: "learning_signal",
      target_id: insight.entity_id,
      title: `Aumentar peso do sinal "${insight.entity_label}" (+${points})`,
      description: `Esse sinal aumenta a taxa positiva em ${(delta * 100).toFixed(1)}% acima da média (amostra ${insight.sample_size}). Sugerido +${points} no impact_score.`,
      impact_estimate: points,
      confidence_score: conf,
      action_payload: { adjustment: points, signal_type, signal_value, max_cap: MAX_SCORE_ADJUST },
    };
  }

  if (insight.insight_type === "template") {
    return {
      organization_id: orgId,
      insight_id: insight.id,
      recommendation_type: "template_change",
      target_type: "outreach_template",
      target_id: insight.entity_id,
      title: `Template "${insight.entity_label}" com baixa resposta`,
      description: `Reply rate de ${(Number(insight.metric_value) * 100).toFixed(1)}% em ${insight.sample_size} envios. Recomendamos depreciar e testar variante.`,
      impact_estimate: -1,
      confidence_score: conf,
      action_payload: { mark_deprecated: true, entity_id: insight.entity_id },
    };
  }

  if (insight.insight_type === "channel") {
    return {
      organization_id: orgId,
      insight_id: insight.id,
      recommendation_type: "channel_shift",
      target_type: "channel",
      target_id: insight.entity_id,
      title: `Priorizar canal "${insight.entity_label}"`,
      description: `Reply rate de ${(Number(insight.metric_value) * 100).toFixed(1)}% vs média ${(Number(insight.baseline_value) * 100).toFixed(1)}% nos demais. Sugerido aumentar volume nesse canal.`,
      impact_estimate: Number((delta * 100).toFixed(1)),
      confidence_score: conf,
      action_payload: { preferred_channel: insight.entity_id },
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  const authHeader = req.headers.get('authorization');
  const hasInternal = expectedSecret && internalSecret === expectedSecret;
  const hasAuth = !!authHeader && authHeader.toLowerCase().startsWith('bearer ');
  if (!hasInternal && !hasAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let body: { organization_id?: string; since?: string } = {};
    try { body = await req.json(); } catch (_) { /* */ }

    let q = client.from("optimization_insights").select("*").order("detected_at", { ascending: false }).limit(500);
    if (body.organization_id) q = q.eq("organization_id", body.organization_id);
    if (body.since) q = q.gte("detected_at", body.since);

    const { data: insights, error } = await q;
    if (error) throw error;

    const created: any[] = [];
    for (const insight of insights ?? []) {
      // Skip if active rec exists for same target
      const { data: existing } = await client
        .from("optimization_recommendations")
        .select("id, status")
        .eq("organization_id", insight.organization_id)
        .eq("target_type", insight.insight_type === "signal" ? "learning_signal" : insight.insight_type === "template" ? "outreach_template" : "channel")
        .eq("target_id", insight.entity_id)
        .in("status", ["pending", "accepted", "auto_applied"])
        .limit(1);
      if (existing && existing.length > 0) continue;

      const rec = buildRecFromInsight(insight);
      if (!rec) continue;

      const { data: inserted, error: insErr } = await client
        .from("optimization_recommendations")
        .insert(rec)
        .select("id")
        .maybeSingle();
      if (insErr) {
        console.error("[generate-recommendations] insert error", insErr.message);
        continue;
      }
      if (inserted) created.push(inserted.id);
    }

    return new Response(JSON.stringify({ ok: true, created: created.length, ids: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-recommendations] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
