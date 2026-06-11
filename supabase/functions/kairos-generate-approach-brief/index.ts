// kairos-generate-approach-brief
// Gera Brief Comercial via OpenAI (padrão do projeto) usando dados de enriched_company_profiles
// e commercial_briefs. Persiste em kairos_qualified_queue.approach_brief e marca approach_ready.

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

interface Brief {
  dores: string[];
  hipoteses: string[];
  angulo: string;
  mensagem: string;
  cta: string;
}

function fallbackBrief(companyName: string): Brief {
  return {
    dores: ["Conversão comercial abaixo do esperado", "Falta de visibilidade do funil"],
    hipoteses: [`${companyName} pode estar perdendo oportunidades por falta de processo de qualificação`],
    angulo: "Mostrar como o NOID estrutura sourcing + qualificação + execução comercial.",
    mensagem: `Olá, vi que ${companyName} tem presença comercial relevante. Faz sentido conversarmos sobre como ajudamos a aumentar conversão sem aumentar headcount?`,
    cta: "Agendar 20 minutos para um diagnóstico rápido",
  };
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

    const { queue_id, prospect_id } = await req.json();
    if (!queue_id || !prospect_id) return json(400, { error: "queue_id and prospect_id required" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: queueItem } = await admin
      .from("kairos_qualified_queue").select("*").eq("id", queue_id).maybeSingle();
    if (!queueItem) return json(404, { error: "queue item not found" });

    const { data: profile } = await admin
      .from("enriched_company_profiles").select("*").eq("prospect_id", prospect_id).maybeSingle();
    const { data: commercial } = await admin
      .from("commercial_briefs").select("*").eq("prospect_id", prospect_id).maybeSingle();

    let brief: Brief = fallbackBrief(queueItem.company_name);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      try {
        const context = {
          company: queueItem.company_name,
          domain: queueItem.domain,
          industry: profile?.industries_detected ?? null,
          summary: profile?.company_summary ?? null,
          pains: profile?.commercial_pains ?? null,
          notes: profile?.strategic_notes ?? null,
          existing_brief: commercial ?? null,
        };
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "Você é um head de pré-vendas. Responda APENAS JSON válido com as chaves: dores (array<string>), hipoteses (array<string>), angulo (string), mensagem (string, ≤600 chars, tom executivo PT-BR), cta (string).",
              },
              {
                role: "user",
                content: `Gere um brief de abordagem para esta empresa. Contexto:\n${JSON.stringify(context)}`,
              },
            ],
          }),
        });
        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text);
          brief = {
            dores: Array.isArray(parsed.dores) ? parsed.dores : brief.dores,
            hipoteses: Array.isArray(parsed.hipoteses) ? parsed.hipoteses : brief.hipoteses,
            angulo: parsed.angulo ?? brief.angulo,
            mensagem: parsed.mensagem ?? brief.mensagem,
            cta: parsed.cta ?? brief.cta,
          };
        }
      } catch (e) {
        console.warn("[approach-brief] OpenAI failed, using fallback", e);
      }
    }

    const newStatus = queueItem.qualification_status === "ready_for_sdr"
      ? "ready_for_sdr"
      : "approach_ready";

    const { data: updated, error: uErr } = await admin
      .from("kairos_qualified_queue")
      .update({ approach_brief: brief, qualification_status: newStatus })
      .eq("id", queue_id)
      .select("*")
      .single();
    if (uErr) throw uErr;

    return json(200, { brief, item: updated });
  } catch (err) {
    console.error("[kairos-generate-approach-brief]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
