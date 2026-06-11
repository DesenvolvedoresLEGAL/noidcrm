// kairos-autopilot-start
// Cria um kairos_batch_run + items para processamento em lote.
// NÃO importa para CRM. Saída sempre = Qualified Queue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AutopilotConfig {
  icp_profile_id?: string | null;
  min_score?: number;
  min_quality?: string | null;
  max_apollo_credits?: number;
  max_contacts_per_company?: number;
  allow_enrichment?: boolean;
  allow_apollo?: boolean;
  generate_brief?: boolean;
}

interface Body {
  prospect_ids?: string[];
  playbook_run_id?: string;
  event_id?: string | null;
  lead_search_id?: string | null;
  run_name?: string;
  config?: AutopilotConfig;
  estimate_only?: boolean;
}

const APOLLO_COST_PER_PROSPECT = 1;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json(401, { error: "Unauthorized" });
    const userId = userRes.user.id;

    const body = (await req.json()) as Body;
    const config: AutopilotConfig = {
      min_score: 0,
      max_apollo_credits: 500,
      max_contacts_per_company: 3,
      allow_enrichment: true,
      allow_apollo: true,
      generate_brief: true,
      ...(body.config ?? {}),
    };

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve prospects
    let prospectQ = admin.from("prospects").select("id,organization_id,company_name,normalized_domain,cnpj,icp_profile_id,confidence,enrichment_status,decision_maker_found,playbook_run_id");
    if (body.prospect_ids?.length) prospectQ = prospectQ.in("id", body.prospect_ids);
    else if (body.playbook_run_id) prospectQ = prospectQ.eq("playbook_run_id", body.playbook_run_id);
    else return json(400, { error: "prospect_ids or playbook_run_id required" });

    const { data: prospects, error: pErr } = await prospectQ.limit(2000);
    if (pErr) throw pErr;
    if (!prospects?.length) return json(400, { error: "no prospects found" });

    const orgId = prospects[0].organization_id;
    // Filter by ICP if configured
    let eligible = prospects;
    if (config.icp_profile_id) {
      eligible = eligible.filter((p) => p.icp_profile_id === config.icp_profile_id);
    }
    if (typeof config.min_score === "number" && config.min_score > 0) {
      eligible = eligible.filter((p) => Number(p.confidence ?? 0) * 100 >= (config.min_score ?? 0));
    }

    const apolloEligible = eligible.filter((p) => !!p.normalized_domain && !p.decision_maker_found);
    const creditsEstimated = config.allow_apollo
      ? Math.min(apolloEligible.length * APOLLO_COST_PER_PROSPECT, config.max_apollo_credits ?? 999999)
      : 0;

    if (body.estimate_only) {
      return json(200, {
        eligible: eligible.length,
        total: prospects.length,
        apollo_eligible: apolloEligible.length,
        credits_estimated: creditsEstimated,
        credits_limit: config.max_apollo_credits,
      });
    }

    if (config.allow_apollo && (config.max_apollo_credits ?? 0) < (apolloEligible.length * APOLLO_COST_PER_PROSPECT)) {
      // soft warning, still allow but cap
    }

    // Create run
    const runName = body.run_name ?? `Autopilot ${new Date().toISOString().slice(0, 16)}`;
    const { data: run, error: rErr } = await admin
      .from("kairos_batch_runs")
      .insert({
        organization_id: orgId,
        event_id: body.event_id ?? null,
        lead_search_id: body.lead_search_id ?? null,
        run_name: runName,
        run_type: body.event_id ? "event" : (body.lead_search_id ? "search" : "manual"),
        status: "pending",
        total_prospects: eligible.length,
        credits_estimated: creditsEstimated,
        config: config as unknown as Record<string, unknown>,
        created_by: userId,
      })
      .select("*")
      .single();
    if (rErr) throw rErr;

    // Items with naive priority_rank from confidence
    const items = eligible.map((p) => {
      const conf = Math.round(Number(p.confidence ?? 0) * 100);
      const icpBoost = p.icp_profile_id ? 20 : 0;
      const domBoost = p.normalized_domain ? 10 : 0;
      const dmBoost = p.decision_maker_found ? 10 : 0;
      return {
        run_id: run.id,
        organization_id: orgId,
        prospect_id: p.id,
        current_stage: "matching" as const,
        status: "pending" as const,
        priority_rank: Math.min(100, conf + icpBoost + domBoost + dmBoost),
      };
    });
    // chunk insert
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500);
      const { error: iErr } = await admin.from("kairos_batch_run_items").insert(chunk);
      if (iErr) throw iErr;
    }

    await admin.from("kairos_batch_logs").insert({
      run_id: run.id,
      organization_id: orgId,
      action: "run_created",
      result: "ok",
      details: { eligible: eligible.length, credits_estimated: creditsEstimated },
    });

    // Fire-and-forget processor
    try {
      await admin.functions.invoke("kairos-autopilot-process", {
        body: { run_id: run.id },
        headers: { Authorization: `Bearer ${serviceKey}` },
      });
    } catch (e) {
      console.warn("[autopilot-start] processor invoke", e);
    }

    return json(200, { run, eligible: eligible.length, credits_estimated: creditsEstimated });
  } catch (err) {
    console.error("[kairos-autopilot-start]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
