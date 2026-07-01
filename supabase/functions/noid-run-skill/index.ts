// noid-run-skill — executa uma skill específica e persiste o run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-client.ts";
import {
  applyGuardrails,
  buildSkillMessages,
  safeParseJson,
  validateAgainstSchema,
  type SkillRow,
} from "../_shared/skills.ts";

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
  const userId = userRes.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const {
    skill_id,
    slug,
    context = {},
    source_module = "manual",
    links = {},
    allow_draft = false,
    dry_run = false,
    organization_id: orgOverride,
  } = body ?? {};

  if (!skill_id && !slug) return json(400, { error: "skill_id_or_slug_required" });

  // Resolve current org from user
  const { data: memberRow } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const organization_id = orgOverride || memberRow?.organization_id || null;

  // Load skill
  let query = admin.from("noid_skills").select("*").limit(1);
  if (skill_id) query = query.eq("id", skill_id);
  else query = query.eq("slug", slug).order("version", { ascending: false });
  const { data: skill, error: skillErr } = await query.maybeSingle();
  if (skillErr || !skill) return json(404, { error: "skill_not_found" });

  const s = skill as SkillRow;
  if (s.status !== "active" && !allow_draft) {
    return json(400, { error: "skill_not_active", status: s.status });
  }

  // Validate input
  const inputCheck = validateAgainstSchema(context, s.input_schema || {});
  if (!inputCheck.ok) {
    const { data: runRow } = await admin.from("noid_skill_runs").insert({
      organization_id, skill_id: s.id, source_module,
      prospect_id: links.prospect_id, account_id: links.account_id,
      opportunity_id: links.opportunity_id, contact_id: links.contact_id,
      input_payload: context, status: "schema_invalid",
      error_message: inputCheck.error, created_by: userId,
    }).select("id").single();
    return json(400, { error: "input_invalid", detail: inputCheck.error, run_id: runRow?.id });
  }

  // Execute
  const messages = buildSkillMessages(s, context);
  const startedAt = Date.now();
  let ai;
  try {
    ai = await callAI({
      messages,
      response_format: { type: "json_object" },
      feature: `noid-skill:${s.slug}`,
      organization_id: organization_id || undefined,
    });
  } catch (e: any) {
    await admin.from("noid_skill_runs").insert({
      organization_id, skill_id: s.id, source_module,
      prospect_id: links.prospect_id, account_id: links.account_id,
      opportunity_id: links.opportunity_id, contact_id: links.contact_id,
      input_payload: context, status: "error",
      error_message: String(e?.message ?? e), created_by: userId,
    });
    return json(500, { error: "ai_failed", detail: String(e?.message ?? e) });
  }

  const output = safeParseJson(ai.content);
  const latency = Date.now() - startedAt;

  if (!output) {
    const { data: runRow } = await admin.from("noid_skill_runs").insert({
      organization_id, skill_id: s.id, source_module,
      input_payload: context, output_payload: { raw: ai.content },
      model_used: ai.model_used, status: "schema_invalid",
      error_message: "json_parse_failed", latency_ms: latency, created_by: userId,
    }).select("id").single();
    return json(422, { error: "invalid_output_json", raw: ai.content, run_id: runRow?.id });
  }

  const outCheck = validateAgainstSchema(output, s.output_schema || {});
  const guardCheck = outCheck.ok ? applyGuardrails(output, s.guardrails || {}) : { ok: false, error: outCheck.error } as const;

  const runStatus = dry_run
    ? "playground"
    : !outCheck.ok
      ? "schema_invalid"
      : !guardCheck.ok
        ? "guardrail_blocked"
        : "success";

  const { data: runRow } = await admin.from("noid_skill_runs").insert({
    organization_id,
    skill_id: s.id,
    source_module,
    prospect_id: links.prospect_id ?? null,
    account_id: links.account_id ?? null,
    opportunity_id: links.opportunity_id ?? null,
    contact_id: links.contact_id ?? null,
    input_payload: context,
    output_payload: output,
    model_used: ai.model_used,
    status: runStatus,
    confidence_score: typeof output?.confidence === "number" ? output.confidence : null,
    latency_ms: latency,
    error_message: outCheck.ok ? (guardCheck.ok ? null : guardCheck.error) : outCheck.error,
    created_by: userId,
  }).select("id").single();

  return json(200, {
    run_id: runRow?.id,
    skill_id: s.id,
    skill_slug: s.slug,
    status: runStatus,
    output,
    model_used: ai.model_used,
    latency_ms: latency,
  });
});
