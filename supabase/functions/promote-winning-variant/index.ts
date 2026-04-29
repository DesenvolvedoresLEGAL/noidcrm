// Sprint E — Promote winning variant: writes content to target_entity,
// records previous state in optimization_actions_log for rollback,
// marks hypothesis as 'promoted'. Called by apply-recommendation when the
// recommendation's action_payload.promote_via === 'promote-winning-variant'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { hypothesis_id, recommendation_id, executed_by = null } = await req.json();
    if (!hypothesis_id) {
      return new Response(JSON.stringify({ error: "hypothesis_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: hyp, error: hErr } = await admin.from("experiment_hypotheses").select("*").eq("id", hypothesis_id).maybeSingle();
    if (hErr || !hyp) throw new Error("hypothesis_not_found");
    if (!hyp.winner_variant_id) throw new Error("no_winner");
    if (hyp.status !== "completed") throw new Error(`invalid_state: ${hyp.status}`);

    const { data: variant } = await admin.from("experiment_variants").select("*").eq("id", hyp.winner_variant_id).single();

    let previous: Record<string, unknown> | null = null;
    let applied = false;

    if (hyp.target_entity === "email_template" && hyp.target_id) {
      const { data: tpl } = await admin.from("email_templates").select("subject, body").eq("id", hyp.target_id).single();
      previous = { subject: tpl?.subject, body: tpl?.body };
      const content: any = variant.content ?? {};
      const { error: uErr } = await admin
        .from("email_templates")
        .update({ subject: content.subject ?? tpl?.subject, body: content.body ?? tpl?.body })
        .eq("id", hyp.target_id);
      if (uErr) throw uErr;
      applied = true;
    }

    await admin.from("optimization_actions_log").insert({
      organization_id: hyp.organization_id,
      recommendation_id: recommendation_id ?? null,
      action_type: "promote_winning_variant",
      executed: applied,
      result: {
        hypothesis_id,
        variant_id: hyp.winner_variant_id,
        target_entity: hyp.target_entity,
        target_id: hyp.target_id,
        previous,
        new_content: variant.content,
      },
      executed_by,
    });

    if (applied) {
      await admin
        .from("experiment_hypotheses")
        .update({ status: "promoted", promoted_at: new Date().toISOString() })
        .eq("id", hypothesis_id);
    }

    return new Response(JSON.stringify({ ok: true, applied }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[promote-winning-variant] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
