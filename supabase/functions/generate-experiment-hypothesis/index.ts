// Sprint E — Generate experiment hypotheses from optimization insights.
// Reads recent insights without an existing hypothesis, applies heuristics,
// respects per-org guardrails (max_experiments_per_day, allowed_hypothesis_types,
// experiments_enabled), and inserts pending hypotheses for human approval.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type HypType = "template" | "channel" | "timing" | "icp";

function classifyInsight(insight: any): { type: HypType; description: string; target_entity: string; target_id: string | null } | null {
  const t = String(insight.insight_type ?? "");
  const label = String(insight.entity_label ?? insight.entity_id ?? "");
  const metric = Number(insight.metric_value ?? 0);
  const delta = Number(insight.delta ?? 0);

  if (t === "template") {
    return {
      type: "template",
      target_entity: "email_template",
      target_id: insight.entity_id,
      description: `Testar variações de copy para o template "${label}" (reply rate atual ${(metric * 100).toFixed(1)}%, ${delta < 0 ? "abaixo" : "acima"} da média).`,
    };
  }
  if (t === "channel") {
    return {
      type: "channel",
      target_entity: "channel",
      target_id: insight.entity_id,
      description: `Testar canal alternativo: ${label} apresenta meeting rate ${(metric * 100).toFixed(1)}%.`,
    };
  }
  if (t === "playbook") {
    return {
      type: "timing",
      target_entity: "playbook_step",
      target_id: insight.entity_id,
      description: `Testar timing de follow-up no playbook "${label}".`,
    };
  }
  if (t === "signal") {
    return {
      type: "icp",
      target_entity: "icp_segment",
      target_id: insight.entity_id,
      description: `Testar segmentação ICP para "${label}" (sinal com lift ${(delta * 100).toFixed(1)}%).`,
    };
  }
  return null;
}

async function processOrg(client: ReturnType<typeof createClient>, orgId: string) {
  // 1. Guardrails
  const { data: gr } = await client
    .from("agent_guardrails")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!gr) return { org: orgId, skipped: "no_guardrails" };
  if (!gr.experiments_enabled) return { org: orgId, skipped: "experiments_disabled" };

  // 2. Count today's hypotheses
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: todayCount } = await client
    .from("experiment_hypotheses")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", since);

  const remaining = Math.max(0, (gr.max_experiments_per_day ?? 5) - (todayCount ?? 0));
  if (remaining === 0) return { org: orgId, skipped: "daily_cap_reached" };

  const allowed = new Set<string>(gr.allowed_hypothesis_types ?? ["template", "channel", "timing", "icp"]);

  // 3. Fetch recent insights with no linked hypothesis
  const { data: insights } = await client
    .from("optimization_insights")
    .select("id, organization_id, insight_type, entity_id, entity_label, metric_value, delta, sample_size, confidence_score")
    .eq("organization_id", orgId)
    .order("detected_at", { ascending: false })
    .limit(50);

  if (!insights || insights.length === 0) return { org: orgId, created: 0 };

  // Filter insights already linked to a hypothesis
  const insightIds = insights.map((i: any) => i.id);
  const { data: existing } = await client
    .from("experiment_hypotheses")
    .select("source_insight_id")
    .in("source_insight_id", insightIds);
  const linked = new Set((existing ?? []).map((r: any) => r.source_insight_id));

  // Filter insights whose target already has a running hypothesis
  const { data: running } = await client
    .from("experiment_hypotheses")
    .select("target_entity, target_id")
    .eq("organization_id", orgId)
    .eq("status", "running");
  const runningKeys = new Set((running ?? []).map((r: any) => `${r.target_entity}::${r.target_id}`));

  const toInsert: any[] = [];
  for (const insight of insights) {
    if (toInsert.length >= remaining) break;
    if (linked.has(insight.id)) continue;
    const cls = classifyInsight(insight);
    if (!cls) continue;
    if (!allowed.has(cls.type)) continue;
    if (runningKeys.has(`${cls.target_entity}::${cls.target_id}`)) continue;

    toInsert.push({
      organization_id: orgId,
      hypothesis_type: cls.type,
      target_entity: cls.target_entity,
      target_id: cls.target_id,
      description: cls.description,
      source_insight_id: insight.id,
      created_by: "system",
      confidence_score: Number(insight.confidence_score ?? 0.5),
      status: "pending",
    });
  }

  if (toInsert.length === 0) return { org: orgId, created: 0 };

  const { data: inserted, error } = await client
    .from("experiment_hypotheses")
    .insert(toInsert)
    .select("id");
  if (error) {
    console.error("[gen-hypothesis] insert error", orgId, error.message);
    return { org: orgId, error: error.message };
  }

  return { org: orgId, created: inserted?.length ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetOrg = body?.organization_id as string | undefined;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let orgIds: string[] = [];
    if (targetOrg) {
      orgIds = [targetOrg];
    } else {
      const { data: orgs, error } = await admin
        .from("organizations")
        .select("id, status")
        .neq("status", "deleted");
      if (error) throw error;
      orgIds = (orgs ?? []).map((o: any) => o.id);
    }

    const results: any[] = [];
    for (const id of orgIds) {
      results.push(await processOrg(admin, id));
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-experiment-hypothesis] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
