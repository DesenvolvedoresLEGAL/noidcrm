import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o NOID Architect, um especialista em projetar agentes de IA para CRM de vendas B2B.

Contexto do sistema:
- O CRM NOID gerencia leads, contatos, contas, oportunidades, propostas, atividades, pipelines, forecasts e playbooks.
- Agentes operam sobre essas entidades com diferentes níveis de autonomia.
- Níveis de autonomia: observer (só observa), recommender (sugere ações), assisted (executa com aprovação), autonomous (executa sozinho), multi_agent (orquestra outros agentes).
- Escopos possíveis: lead, contact, account, opportunity, proposal, activity, pipeline, forecast, playbook, external_signal.
- Canais: email, whatsapp, internal, slack, phone, sms.

Sua tarefa:
Dado o texto do usuário (uma descrição de agente desejado OU um prompt colado de outra ferramenta), extraia e estruture um blueprint completo do agente.

Regras:
1. Sempre gere um nome descritivo e conciso em português.
2. Infira o máximo possível do texto, mas sinalize o que ficou ambíguo.
3. Para prompts importados, identifique as camadas (system, deliberation, generation, review) se possível.
4. Seja prescritivo nas sugestões de tools, triggers e regras.
5. Sempre inclua warnings sobre riscos potenciais.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { mode, text } = body;

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = mode === "prompt_import"
      ? `O usuário colou o seguinte prompt de outra ferramenta de IA. Analise e converta em um blueprint de agente NOID:\n\n---\n${text}\n---\n\nIdentifique o que foi possível extrair e sinalize ambiguidades.`
      : `O usuário descreveu o agente que deseja criar:\n\n"${text}"\n\nGere um blueprint completo para este agente.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_blueprint",
              description: "Gera o blueprint estruturado de um agente de IA para CRM",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nome do agente" },
                  objective: { type: "string", description: "Objetivo principal do agente" },
                  description: { type: "string", description: "Descrição operacional detalhada" },
                  suggested_type: {
                    type: "string",
                    enum: ["reactive", "proactive", "hybrid", "utility"],
                    description: "Tipo sugerido de agente",
                  },
                  autonomy_level: {
                    type: "string",
                    enum: ["observer", "recommender", "assisted", "autonomous", "multi_agent"],
                  },
                  primary_channel: {
                    type: "string",
                    description: "Canal principal (email, whatsapp, internal, slack, phone, sms)",
                  },
                  agent_scope: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["lead", "contact", "account", "opportunity", "proposal", "activity", "pipeline", "forecast", "playbook", "external_signal"],
                    },
                  },
                  prompts: {
                    type: "object",
                    properties: {
                      system: { type: "string" },
                      deliberation: { type: "string" },
                      generation: { type: "string" },
                      review: { type: "string" },
                    },
                  },
                  suggested_triggers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        event: { type: "string" },
                        condition: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["event", "description"],
                    },
                  },
                  suggested_tools: {
                    type: "array",
                    items: { type: "string" },
                    description: "Ferramentas sugeridas para o agente",
                  },
                  suggested_rules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        rule: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      },
                      required: ["rule"],
                    },
                  },
                  escalation_criteria: {
                    type: "array",
                    items: { type: "string" },
                    description: "Critérios para escalonamento humano",
                  },
                  warnings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Riscos ou alertas sobre o agente",
                  },
                  missing_info: {
                    type: "array",
                    items: { type: "string" },
                    description: "Informações que estão faltando ou ambíguas",
                  },
                },
                required: ["name", "objective", "description", "autonomy_level", "agent_scope", "prompts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_blueprint" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao gerar blueprint" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "IA não retornou blueprint estruturado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let blueprint;
    try {
      blueprint = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      console.error("Failed to parse arguments:", toolCall.function.arguments);
      return new Response(JSON.stringify({ error: "Erro ao interpretar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ blueprint }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
