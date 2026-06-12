// kairos-apollo-estimate — dry-run de elegibilidade Apollo para um lote de prospects.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  organization_id: string;
  prospect_ids?: string[];
  batch_run_id?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const body = (await req.json()) as Body;
    if (!body?.organization_id) return json(400, { error: "organization_id required" });

    let ids = body.prospect_ids ?? [];
    if (body.batch_run_id && ids.length === 0) {
      const { data: items } = await admin
        .from("kairos_batch_run_items")
        .select("prospect_id")
        .eq("run_id", body.batch_run_id);
      ids = (items ?? []).map((i: any) => i.prospect_id);
    }

    const { data: rules } = await admin
      .from("apollo_auto_enrichment_rules")
      .select("*")
      .eq("organization_id", body.organization_id)
      .maybeSingle();
    const maxContacts = rules?.max_contacts_per_company ?? 3;
    const dailyLimit = rules?.max_apollo_credits_per_day ?? 500;
    const batchLimit = rules?.max_apollo_credits_per_batch ?? 200;

    let eligible = 0;
    let ineligible = 0;
    const reasons: Record<string, number> = {};
    for (const pid of ids) {
      const { data: e } = await admin.rpc("fn_apollo_should_run", {
        p_prospect_id: pid,
        p_org: body.organization_id,
      });
      const row = Array.isArray(e) ? e[0] : e;
      if (row?.eligible) eligible += 1;
      else {
        ineligible += 1;
        const r = row?.reason ?? "unknown";
        reasons[r] = (reasons[r] ?? 0) + 1;
      }
    }

    const { data: usedRaw } = await admin.rpc("fn_apollo_credits_used_today", {
      p_org: body.organization_id,
    });
    const dailyUsed = Number(usedRaw ?? 0);

    const estimatedContacts = eligible * maxContacts;
    const estimatedCredits = eligible * (1 + maxContacts); // enrich + reveal per contact

    return json(200, {
      eligible_count: eligible,
      ineligible_count: ineligible,
      ineligible_reasons: reasons,
      estimated_contacts: estimatedContacts,
      estimated_credits: estimatedCredits,
      daily_limit: dailyLimit,
      daily_used: dailyUsed,
      batch_limit: batchLimit,
      will_exceed_daily: dailyUsed + estimatedCredits > dailyLimit,
      will_exceed_batch: estimatedCredits > batchLimit,
    });
  } catch (err) {
    console.error("[kairos-apollo-estimate]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
