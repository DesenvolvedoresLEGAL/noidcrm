// Sprint E — Assign a variant to an outreach for a given (target, opportunity).
// Deterministic hash by (opportunity_id + hypothesis_id) -> stable bucket.
// Idempotent: returns existing run if already assigned for that hypothesis+opportunity.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hashBucket(seed: string): Promise<number> {
  const enc = new TextEncoder().encode(seed);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const view = new DataView(buf);
  return view.getUint32(0) % 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      organization_id,
      target_entity,
      target_id,
      opportunity_id,
      contact_id = null,
      prospect_id = null,
    } = body ?? {};

    if (!organization_id || !target_entity || !opportunity_id) {
      return new Response(JSON.stringify({ error: "organization_id, target_entity, opportunity_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find a running hypothesis for this target
    const { data: hyps } = await admin
      .from("experiment_hypotheses")
      .select("id, organization_id, target_entity, target_id, status")
      .eq("organization_id", organization_id)
      .eq("status", "running")
      .eq("target_entity", target_entity)
      .eq("target_id", target_id ?? null);

    if (!hyps || hyps.length === 0) {
      return new Response(JSON.stringify({ ok: true, assigned: false, reason: "no_running_hypothesis" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hyp = hyps[0];

    // Idempotency: existing run?
    const { data: existing } = await admin
      .from("experiment_runs")
      .select("id, variant_id, experiment_variants:variant_id(content, variant_label, is_control)")
      .eq("hypothesis_id", hyp.id)
      .eq("opportunity_id", opportunity_id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, assigned: true, run_id: existing.id, variant: existing.experiment_variants, idempotent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch variants ordered by label
    const { data: variants } = await admin
      .from("experiment_variants")
      .select("id, variant_label, is_control, content, allocation_percentage")
      .eq("hypothesis_id", hyp.id)
      .order("variant_label", { ascending: true });
    if (!variants || variants.length === 0) {
      return new Response(JSON.stringify({ ok: true, assigned: false, reason: "no_variants" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bucket via deterministic hash
    const bucket = await hashBucket(`${opportunity_id}:${hyp.id}`);
    let cum = 0;
    let chosen = variants[variants.length - 1];
    for (const v of variants) {
      cum += v.allocation_percentage ?? 0;
      if (bucket < cum) { chosen = v; break; }
    }

    const { data: run, error: rErr } = await admin
      .from("experiment_runs")
      .insert({
        organization_id,
        hypothesis_id: hyp.id,
        variant_id: chosen.id,
        opportunity_id,
        contact_id,
        prospect_id,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (rErr) {
      // Handle race on unique (hypothesis_id, opportunity_id)
      if (String(rErr.message).includes("duplicate")) {
        const { data: again } = await admin
          .from("experiment_runs")
          .select("id, variant_id, experiment_variants:variant_id(content, variant_label, is_control)")
          .eq("hypothesis_id", hyp.id)
          .eq("opportunity_id", opportunity_id)
          .maybeSingle();
        return new Response(JSON.stringify({ ok: true, assigned: true, run_id: again?.id, variant: again?.experiment_variants, idempotent: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw rErr;
    }

    return new Response(JSON.stringify({
      ok: true,
      assigned: true,
      run_id: run.id,
      hypothesis_id: hyp.id,
      variant: { id: chosen.id, variant_label: chosen.variant_label, is_control: chosen.is_control, content: chosen.content },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[assign-variant] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
