// noid-skill-router — mapeia goal → skill ativa e delega ao noid-run-skill.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type GoalMap = { category: string; skill_type: string; slug_hint?: string };

const GOAL_MAP: Record<string, GoalMap> = {
  generate_whatsapp_message: { category: "prospecting", skill_type: "message_generation", slug_hint: "first-touch-whatsapp-expositor" },
  generate_email_message:    { category: "prospecting", skill_type: "message_generation", slug_hint: "first-touch-email-expositor" },
  generate_call_script:      { category: "prospecting", skill_type: "message_generation", slug_hint: "call-script-expositor" },
  handle_objection_price:    { category: "objection_handling", skill_type: "objection_response", slug_hint: "objection-price-too-high" },
  handle_objection_vendor:   { category: "objection_handling", skill_type: "objection_response", slug_hint: "objection-already-has-vendor" },
  handle_objection_think:    { category: "follow_up", skill_type: "objection_response", slug_hint: "objection-will-think-about-it" },
  qualify_expositor:         { category: "qualification", skill_type: "qualification_question", slug_hint: "qualification-questions-expositor" },
  reactivate_lead:           { category: "reactivation", skill_type: "message_generation", slug_hint: "reactivate-stale-lead" },
  explain_event_internet:    { category: "technical_explanation", skill_type: "summary", slug_hint: "explain-professional-event-internet" },
  next_best_action:          { category: "next_best_action", skill_type: "recommendation", slug_hint: "next-best-action" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "missing_auth" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json(401, { error: "invalid_auth" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const { source_module, goal, context = {}, links = {}, preferred_category } = body ?? {};
  if (!goal) return json(400, { error: "goal_required" });

  const mapped = GOAL_MAP[goal];
  if (!mapped) return json(400, { error: "unknown_goal", goal });

  const category = preferred_category || mapped.category;

  // Try slug hint first (highest version)
  let chosen: any = null;
  if (mapped.slug_hint) {
    const { data } = await admin
      .from("noid_skills")
      .select("*")
      .eq("slug", mapped.slug_hint)
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    chosen = data;
  }
  if (!chosen) {
    const { data } = await admin
      .from("noid_skills")
      .select("*")
      .eq("category", category)
      .eq("skill_type", mapped.skill_type)
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    chosen = data;
  }
  if (!chosen) return json(404, { error: "no_matching_skill", goal });

  // Delegate to noid-run-skill
  const runResp = await fetch(`${supabaseUrl}/functions/v1/noid-run-skill`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({
      skill_id: chosen.id,
      context,
      source_module: source_module || "router",
      links,
    }),
  });
  const runData = await runResp.json().catch(() => ({}));
  if (!runResp.ok) return json(runResp.status, { error: "run_failed", detail: runData });

  return json(200, {
    skill_id: chosen.id,
    skill_slug: chosen.slug,
    ...runData,
  });
});
