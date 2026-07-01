// kairos-generate-sdr-message (KAI.19)
// Gera mensagem sugerida (whatsapp/email/linkedin/call) para uma task SDR.
// NÃO envia. Apenas cacheia em suggested_messages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Channel = "whatsapp" | "email" | "linkedin" | "call";

const SYSTEM_BY_CHANNEL: Record<Channel, string> = {
  whatsapp:
    "Você é SDR consultivo brasileiro. Escreva 1 mensagem de WhatsApp curta, humana, no máximo 500 caracteres. Sem textão. Sem parecer robô. CTA simples.",
  email:
    "Você é SDR consultivo brasileiro. Gere um e-mail com assunto objetivo e corpo até 120 palavras, CTA claro. Retorne JSON {subject, body}.",
  linkedin:
    "Você é SDR consultivo brasileiro. Escreva nota curta de conexão LinkedIn (máx 300 caracteres), consultiva.",
  call:
    "Você é SDR consultivo brasileiro. Gere um roteiro de ligação curto em JSON: {opening, main_question, objections:[{objection, response}], closing}. Tom natural.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json(401, { error: "missing_authorization" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json(401, { error: "unauthorized" });
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const body = (await req.json().catch(() => ({}))) as {
      task_id?: string;
      channel?: Channel;
      force_refresh?: boolean;
    };
    if (!body.task_id || !body.channel) return json(400, { error: "task_id_and_channel_required" });
    if (!["whatsapp", "email", "linkedin", "call"].includes(body.channel)) {
      return json(400, { error: "invalid_channel" });
    }

    const { data: task, error: tErr } = await admin
      .from("kairos_sdr_copilot_tasks")
      .select("*")
      .eq("id", body.task_id)
      .maybeSingle();
    if (tErr || !task) return json(404, { error: "task_not_found" });

    // Cache hit
    const cached = (task.suggested_messages as Record<string, unknown>)?.[body.channel];
    if (cached && !body.force_refresh) {
      return json(200, { channel: body.channel, message: cached, cached: true });
    }

    // --- Skills Engine (NS.01): tentar router antes do prompt fixo ---
    const GOAL_BY_CHANNEL: Record<Channel, string> = {
      whatsapp: "generate_whatsapp_message",
      email: "generate_email_message",
      call: "generate_call_script",
      linkedin: "generate_whatsapp_message", // nota curta de conexão usa mesmo padrão
    };


    // Contexto
    const { data: prospect } = await admin
      .from("prospects")
      .select("company_name, event_id, source")
      .eq("id", task.prospect_id ?? "")
      .maybeSingle();

    let eventName: string | null = null;
    if (prospect?.event_id) {
      const { data: ev } = await admin
        .from("source_pages").select("title").eq("id", prospect.event_id).maybeSingle();
      eventName = (ev as any)?.title ?? null;
    }

    let firstName = "";
    if (task.contact_id) {
      const { data: c } = await admin.from("contacts").select("nome").eq("id", task.contact_id).maybeSingle();
      firstName = (c as any)?.nome ?? "";
    }

    const { data: org } = await admin
      .from("organizations").select("name, business_description").eq("id", task.organization_id).maybeSingle();

    const brief = task.commercial_brief as any;

    const ctx = {
      first_name: firstName || "tudo bem",
      company_name: prospect?.company_name ?? "",
      event_name: eventName ?? "",
      organization_name: (org as any)?.name ?? "",
      organization_offer: (org as any)?.business_description ?? "",
      pain: brief?.pain ?? brief?.dor ?? null,
      value_hypothesis: brief?.value_hypothesis ?? brief?.hipotese ?? null,
      cta: task.cta ?? brief?.cta ?? null,
      objections: task.objections ?? [],
    };

    const userPrompt = [
      `Contexto comercial:`,
      JSON.stringify(ctx, null, 2),
      ``,
      body.channel === "email"
        ? `Retorne JSON {subject, body}.`
        : body.channel === "call"
        ? `Retorne JSON {opening, main_question, objections:[{objection,response}], closing}.`
        : `Retorne apenas o texto da mensagem, sem aspas.`,
    ].join("\n");

    const needsJson = body.channel === "email" || body.channel === "call";

    // Tenta o Skills Engine router; se falhar, usa AI direto abaixo.
    try {
      const routerResp = await fetch(`${SUPABASE_URL}/functions/v1/noid-skill-router`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: ANON,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_module: "kairos_sdr_copilot",
          goal: GOAL_BY_CHANNEL[body.channel],
          context: {
            company_name: ctx.company_name,
            event_name: ctx.event_name,
            primary_contact_name: firstName,
            pain_hypothesis: ctx.pain,
            product_context: ctx.organization_offer,
            tone: "consultivo",
            last_touch_summary: brief?.last_touch_summary ?? null,
          },
          links: {
            prospect_id: task.prospect_id,
            opportunity_id: task.opportunity_id,
            contact_id: task.contact_id,
            account_id: task.account_id,
          },
        }),
      });
      if (routerResp.ok) {
        const rd = await routerResp.json();
        if (rd?.output && (rd.status === "success" || rd.status === "guardrail_blocked")) {
          const payload = {
            ...rd.output,
            _skill: { run_id: rd.run_id, skill_slug: rd.skill_slug, status: rd.status },
          };
          const newMessages = { ...(task.suggested_messages as Record<string, unknown>), [body.channel]: payload };
          await admin.from("kairos_sdr_copilot_tasks").update({ suggested_messages: newMessages }).eq("id", task.id);
          await admin.from("revenue_events").insert({
            organization_id: task.organization_id,
            event_type: "sdr_message_generated",
            actor_user_id: userId,
            payload: { task_id: task.id, channel: body.channel, via: "skills_engine", skill_slug: rd.skill_slug, run_id: rd.run_id },
          });
          return json(200, { channel: body.channel, message: payload, cached: false, via: "skills_engine" });
        }
      } else {
        console.warn("[sdr-copilot] skill router non-ok", routerResp.status);
      }
    } catch (e) {
      console.warn("[sdr-copilot] skill router failed, falling back:", (e as Error).message);
    }


      messages: [
        { role: "system", content: SYSTEM_BY_CHANNEL[body.channel] },
        { role: "user", content: userPrompt },
      ],
      response_format: needsJson ? { type: "json_object" } : undefined,
      temperature: 0.6,
      max_tokens: 600,
    });

    let parsed: unknown = ai.content;
    if (needsJson) {
      try { parsed = JSON.parse(ai.content); } catch { /* keep raw */ }
    } else {
      parsed = String(ai.content ?? "").trim();
    }

    // Persiste no cache
    const newMessages = { ...(task.suggested_messages as Record<string, unknown>), [body.channel]: parsed };
    await admin
      .from("kairos_sdr_copilot_tasks")
      .update({ suggested_messages: newMessages })
      .eq("id", task.id);

    // Revenue event
    await admin.from("revenue_events").insert({
      organization_id: task.organization_id,
      event_type: "sdr_message_generated",
      actor_user_id: userId,
      payload: { task_id: task.id, channel: body.channel },
    });

    return json(200, { channel: body.channel, message: parsed, cached: false });
  } catch (e) {
    console.error("kairos-generate-sdr-message error:", e);
    return json(500, { error: String(e) });
  }
});
