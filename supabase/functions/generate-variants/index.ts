// Sprint E — Generate variants for an approved hypothesis using OpenAI tool calling.
// Always includes 1 control variant (cloned from current target). Moves hypothesis to 'running'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchControlContent(client: any, hyp: any): Promise<{ content: Record<string, unknown>; ok: boolean }> {
  if (hyp.target_entity === "email_template" && hyp.target_id) {
    const { data: tpl } = await client.from("email_templates").select("subject, body").eq("id", hyp.target_id).maybeSingle();
    if (tpl) return { ok: true, content: { subject: tpl.subject, body: tpl.body } };
  }
  return { ok: false, content: { note: "control_unavailable" } };
}

function buildPrompt(hyp: any, control: Record<string, unknown>) {
  return [
    {
      role: "system" as const,
      content:
        "Você é um especialista em copy de outreach B2B. Gere variações de mensagem com abordagens distintas (direta, consultiva, provocativa). Mantenha o mesmo objetivo da mensagem original. Responda apenas via tool call.",
    },
    {
      role: "user" as const,
      content: `Hipótese: ${hyp.description}\nTipo: ${hyp.hypothesis_type}\nAlvo: ${hyp.target_entity}\nConteúdo de controle:\n${JSON.stringify(control, null, 2)}`,
    },
  ];
}

const VARIANTS_TOOL = {
  type: "function" as const,
  function: {
    name: "propose_variants",
    description: "Propõe 2 variantes (sem contar o controle).",
    parameters: {
      type: "object",
      properties: {
        variants: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "object",
            properties: {
              approach: { type: "string", enum: ["direct", "consultive", "provocative"] },
              subject: { type: "string" },
              body: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["approach", "subject", "body", "rationale"],
            additionalProperties: false,
          },
        },
      },
      required: ["variants"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { hypothesis_id } = await req.json();
    if (!hypothesis_id) return new Response(JSON.stringify({ error: "hypothesis_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: hyp, error: hErr } = await admin.from("experiment_hypotheses").select("*").eq("id", hypothesis_id).maybeSingle();
    if (hErr || !hyp) throw new Error("hypothesis_not_found");
    if (hyp.status !== "approved") throw new Error(`invalid_state: ${hyp.status}`);

    const { data: gr } = await admin.from("agent_guardrails").select("*").eq("organization_id", hyp.organization_id).maybeSingle();
    const maxVariants = Math.min(3, gr?.max_variants_per_test ?? 3);

    // Already has variants? abort to keep idempotent
    const { count: existingCount } = await admin
      .from("experiment_variants")
      .select("*", { count: "exact", head: true })
      .eq("hypothesis_id", hypothesis_id);
    if ((existingCount ?? 0) > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "variants_exist" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const control = await fetchControlContent(admin, hyp);

    let aiVariants: Array<{ subject: string; body: string; approach: string; rationale: string }> = [];
    try {
      const ai = await callAI({
        model: "openai/gpt-5-mini",
        messages: buildPrompt(hyp, control.content),
        tools: [VARIANTS_TOOL],
        tool_choice: { type: "function", function: { name: "propose_variants" } },
        feature: "generate_variants",
        organization_id: hyp.organization_id,
      });
      const call = ai.tool_calls?.[0];
      if (call) {
        const parsed = JSON.parse(call.function.arguments);
        aiVariants = parsed.variants ?? [];
      }
    } catch (e) {
      console.error("[generate-variants] AI failed", e);
    }

    // Build inserts. Always control as A.
    const inserts: any[] = [];
    inserts.push({
      organization_id: hyp.organization_id,
      hypothesis_id,
      variant_label: "A",
      is_control: true,
      content: control.content,
      allocation_percentage: 0, // recomputed below
    });

    const labels = ["B", "C"];
    const slice = aiVariants.slice(0, Math.max(0, maxVariants - 1));
    slice.forEach((v, i) => {
      inserts.push({
        organization_id: hyp.organization_id,
        hypothesis_id,
        variant_label: labels[i],
        is_control: false,
        content: { subject: v.subject, body: v.body, approach: v.approach, rationale: v.rationale },
        allocation_percentage: 0,
      });
    });

    if (inserts.length < 2) throw new Error("insufficient_variants_generated");

    const split = Math.floor(100 / inserts.length);
    inserts.forEach((row, i) => {
      row.allocation_percentage = i === inserts.length - 1 ? 100 - split * (inserts.length - 1) : split;
    });

    const { error: vErr } = await admin.from("experiment_variants").insert(inserts);
    if (vErr) throw vErr;

    await admin
      .from("experiment_hypotheses")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", hypothesis_id);

    return new Response(JSON.stringify({ ok: true, variants: inserts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-variants] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
