// kairos-autopilot-process
// Background worker do Autopilot. Processa items pending/running de uma run.
// NUNCA cria oportunidade/conta. Saída = Qualified Queue.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body { run_id: string }
interface RunConfig {
  min_score?: number;
  min_quality?: string | null;
  max_apollo_credits?: number;
  max_contacts_per_company?: number;
  allow_enrichment?: boolean;
  allow_apollo?: boolean;
  generate_brief?: boolean;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function log(admin: SupabaseClient, runId: string, orgId: string, prospectId: string | null, action: string, result: string, details: Record<string, unknown> = {}) {
  try {
    await admin.from("kairos_batch_logs").insert({
      run_id: runId, organization_id: orgId, prospect_id: prospectId, action, result, details,
    });
  } catch (e) { console.warn("[autopilot] log fail", e); }
}

async function processItem(admin: SupabaseClient, runId: string, item: any, config: RunConfig, creditsUsedRef: { v: number }, serviceKey: string) {
  const orgId = item.organization_id;
  const prospectId = item.prospect_id;
  await admin.from("kairos_batch_run_items").update({
    status: "running", started_at: new Date().toISOString(), current_stage: "matching",
  }).eq("id", item.id);

  // Step 1: enqueue (this also runs matching internally)
  let queueItem: any = null;
  try {
    const r = await admin.functions.invoke("kairos-enqueue-prospect", {
      body: { prospect_id: prospectId },
      headers: { Authorization: `Bearer ${serviceKey}` },
    });
    queueItem = r?.data?.item ?? null;
    await log(admin, runId, orgId, prospectId, "matching", queueItem?.relationship_status ?? "unknown", { queue_id: queueItem?.id });
  } catch (e) {
    await log(admin, runId, orgId, prospectId, "matching", "failed", { error: String(e) });
    await admin.from("kairos_batch_run_items").update({
      status: "failed", message: "Matching falhou", completed_at: new Date().toISOString(),
    }).eq("id", item.id);
    return { result: "failed" };
  }

  // Step 2: existing customer → skip
  if (queueItem?.qualification_status === "existing_customer") {
    await admin.from("kairos_batch_run_items").update({
      status: "skipped", current_stage: "completed",
      message: "Cliente existente — não enriquecido",
      completed_at: new Date().toISOString(),
    }).eq("id", item.id);
    return { result: "skipped" };
  }

  // Step 4: enrichment
  if (config.allow_enrichment && queueItem?.enrichment_status !== "enriched") {
    await admin.from("kairos_batch_run_items").update({ current_stage: "enrichment" }).eq("id", item.id);
    try {
      await admin.functions.invoke("run-enrichment", {
        body: { prospect_id: prospectId, workspace_id: orgId },
        headers: { Authorization: `Bearer ${serviceKey}` },
      });
      await log(admin, runId, orgId, prospectId, "enrichment", "ok");
    } catch (e) {
      await log(admin, runId, orgId, prospectId, "enrichment", "failed", { error: String(e) });
    }
  }

  // Step 5: Apollo
  const apolloLimit = config.max_apollo_credits ?? 0;
  if (config.allow_apollo && creditsUsedRef.v < apolloLimit) {
    const { data: prospect } = await admin.from("prospects").select("normalized_domain,decision_maker_found,email_public,confidence").eq("id", prospectId).maybeSingle();
    const minScore = config.min_score ?? 0;
    const score = Math.round(Number(prospect?.confidence ?? 0) * 100);
    if (prospect?.normalized_domain && !prospect.decision_maker_found && score >= minScore) {
      await admin.from("kairos_batch_run_items").update({ current_stage: "apollo" }).eq("id", item.id);
      try {
        await admin.functions.invoke("run-apollo-enrichment", {
          body: { prospect_id: prospectId, max_contacts: config.max_contacts_per_company ?? 3 },
          headers: { Authorization: `Bearer ${serviceKey}` },
        });
        creditsUsedRef.v += 1;
        await log(admin, runId, orgId, prospectId, "apollo", "ok", { credits_used: creditsUsedRef.v });
      } catch (e) {
        await log(admin, runId, orgId, prospectId, "apollo", "failed", { error: String(e) });
      }
    } else {
      await log(admin, runId, orgId, prospectId, "apollo", "skipped", { reason: !prospect?.normalized_domain ? "no_domain" : prospect.decision_maker_found ? "already_has_dm" : "low_score" });
    }
  } else if (config.allow_apollo) {
    await log(admin, runId, orgId, prospectId, "apollo", "skipped", { reason: "credit_limit_reached" });
  }

  // Step 7: brief
  if (config.generate_brief) {
    await admin.from("kairos_batch_run_items").update({ current_stage: "approach" }).eq("id", item.id);
    try {
      await admin.functions.invoke("kairos-generate-approach-brief", {
        body: { queue_id: queueItem?.id, prospect_id: prospectId },
        headers: { Authorization: `Bearer ${serviceKey}` },
      });
      await log(admin, runId, orgId, prospectId, "brief", "ok");
    } catch (e) {
      await log(admin, runId, orgId, prospectId, "brief", "failed", { error: String(e) });
    }
  }

  // Step 8: refresh queue row so trigger recomputes score/sdr_ready
  try {
    await admin.from("kairos_qualified_queue").update({ updated_at: new Date().toISOString() }).eq("prospect_id", prospectId);
  } catch { /* noop */ }

  await admin.from("kairos_batch_run_items").update({
    status: "done", current_stage: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", item.id);
  return { result: "done" };
}

async function processRun(admin: SupabaseClient, runId: string, serviceKey: string) {
  const { data: run } = await admin.from("kairos_batch_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return;
  if (!["pending", "running", "paused"].includes(run.status)) return;

  await admin.from("kairos_batch_runs").update({
    status: "running",
    started_at: run.started_at ?? new Date().toISOString(),
  }).eq("id", runId);

  const config = (run.config ?? {}) as RunConfig;
  const creditsUsed = { v: run.credits_used ?? 0 };
  let processed = run.processed ?? 0;
  let skipped = run.skipped ?? 0;
  let failed = run.failed ?? 0;

  // Process in batches of 25, checking control between
  while (true) {
    const { data: current } = await admin.from("kairos_batch_runs").select("status").eq("id", runId).maybeSingle();
    if (!current || ["paused", "cancelled", "failed"].includes(current.status)) break;

    const { data: items } = await admin.from("kairos_batch_run_items")
      .select("*").eq("run_id", runId).eq("status", "pending")
      .order("priority_rank", { ascending: false }).limit(10);
    if (!items?.length) break;

    for (const item of items) {
      try {
        const res = await processItem(admin, runId, item, config, creditsUsed, serviceKey);
        if (res.result === "done") processed += 1;
        else if (res.result === "skipped") skipped += 1;
        else failed += 1;
      } catch (e) {
        console.error("[autopilot] item error", e);
        failed += 1;
        await admin.from("kairos_batch_run_items").update({
          status: "failed", message: String(e), completed_at: new Date().toISOString(),
        }).eq("id", item.id);
      }
      await admin.from("kairos_batch_runs").update({
        processed, skipped, failed, credits_used: creditsUsed.v,
      }).eq("id", runId);
    }
  }

  // Finalize
  const { data: leftover } = await admin.from("kairos_batch_run_items")
    .select("id", { count: "exact", head: true }).eq("run_id", runId).eq("status", "pending");
  const { data: latest } = await admin.from("kairos_batch_runs").select("status").eq("id", runId).maybeSingle();
  if (latest?.status === "cancelled" || latest?.status === "paused") return;

  await admin.from("kairos_batch_runs").update({
    status: "completed", completed_at: new Date().toISOString(),
    processed, skipped, failed, credits_used: creditsUsed.v,
  }).eq("id", runId);
  await log(admin, runId, "", null, "run_completed", "ok", { processed, skipped, failed, credits_used: creditsUsed.v });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    if (!body?.run_id) return json(400, { error: "run_id required" });

    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined") {
      // @ts-ignore
      EdgeRuntime.waitUntil(processRun(admin, body.run_id, serviceKey));
      return json(202, { status: "processing", run_id: body.run_id });
    }
    await processRun(admin, body.run_id, serviceKey);
    return json(200, { status: "completed", run_id: body.run_id });
  } catch (err) {
    console.error("[kairos-autopilot-process]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
