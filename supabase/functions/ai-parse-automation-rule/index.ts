import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRIGGER_TYPES = [
  'stage_enter',
  'stage_exit', 
  'opportunity_won',
  'opportunity_lost',
  'activity_completed',
  'opportunity_created',
  'proposal_viewed'
];

const ACTION_TYPES = [
  'move_stage',
  'move_next_stage',
  'move_previous_stage',
  'duplicate',
  'close_won',
  'close_lost',
  'create_activity',
  'update_fields',
  'notify_user'
];

const CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty'
];

const ACTIVITY_TYPES = [
  'call',
  'email',
  'meeting',
  'task',
  'follow_up',
  'proposal',
  'visit'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, existingRules } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Build context for the AI
    const pipelinesContext = context?.pipelines?.map((p: any) => ({
      id: p.id,
      name: p.name,
      stages: p.stages?.map((s: any) => ({ id: s.id, name: s.name })) || []
    })) || [];

    const usersContext = context?.users?.map((u: any) => ({
      id: u.id,
      name: u.name || u.email
    })) || [];

    const existingRulesContext = existingRules?.map((r: any) => ({
      id: r.id,
      name: r.name,
      trigger_type: r.trigger_type,
      is_active: r.is_active
    })) || [];

    const systemPrompt = `Você é um assistente especializado em CRM que converte comandos em linguagem natural para regras de automação de workflow.

CONTEXTO DISPONÍVEL:
- Pipelines e Etapas: ${JSON.stringify(pipelinesContext)}
- Usuários: ${JSON.stringify(usersContext)}
- Regras Existentes: ${JSON.stringify(existingRulesContext)}

TIPOS DE GATILHO DISPONÍVEIS:
- stage_enter: Quando uma oportunidade entra em uma etapa específica
- stage_exit: Quando uma oportunidade sai de uma etapa específica
- opportunity_won: Quando uma oportunidade é marcada como ganha
- opportunity_lost: Quando uma oportunidade é marcada como perdida
- activity_completed: Quando uma atividade é concluída
- opportunity_created: Quando uma nova oportunidade é criada
- proposal_viewed: Quando o cliente visualiza a proposta

TIPOS DE AÇÃO DISPONÍVEIS:
- move_stage: Mover para uma etapa específica (requer target_stage_id)
- move_next_stage: Mover para a próxima etapa
- move_previous_stage: Voltar para a etapa anterior
- duplicate: Duplicar a oportunidade (pode ter handoff_to_user_id para novo responsável)
- close_won: Encerrar como ganha
- close_lost: Encerrar como perdida (pode ter loss_reason_id)
- create_activity: Criar atividade (requer activity_type, title, opcionalmente days_offset)
- update_fields: Atualizar campos (requer array de fields com name e value)
- notify_user: Notificar usuário (requer user_id e message)

TIPOS DE ATIVIDADE: call, email, meeting, task, follow_up, proposal, visit

OPERADORES DE CONDIÇÃO: equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty

CAMPOS DISPONÍVEIS PARA CONDIÇÕES: value (valor da oportunidade), probability (probabilidade), temperature (cold/warm/hot/burning), stage_id, owner_user_id

INSTRUÇÕES:
1. Analise o comando do usuário e determine a intenção:
   - "create": Criar nova regra
   - "update": Editar regra existente (referência por nome)
   - "delete": Excluir regra existente
   - "list": Listar regras existentes
   - "toggle": Ativar/desativar regra

2. Para criar/editar, extraia:
   - Nome sugerido para a regra
   - Tipo de gatilho e configuração
   - Condições (se mencionadas)
   - Ações a serem executadas

3. Mapeie nomes de etapas/pipelines/usuários para seus IDs usando o contexto fornecido.

4. Se o comando for ambíguo, defina action como "clarify" e explique o que precisa ser esclarecido.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_automation_command",
              description: "Parse a natural language command into a structured automation rule action",
              parameters: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["create", "update", "delete", "list", "toggle", "clarify"],
                    description: "The type of action to perform"
                  },
                  rule_id: {
                    type: "string",
                    description: "ID of existing rule (for update/delete/toggle)"
                  },
                  rule_name: {
                    type: "string",
                    description: "Name pattern to match (for update/delete/toggle by name)"
                  },
                  workflow_rule: {
                    type: "object",
                    description: "The workflow rule configuration (for create/update)",
                    properties: {
                      name: { type: "string", description: "Name of the rule" },
                      description: { type: "string", description: "Description of what the rule does" },
                      is_active: { type: "boolean", description: "Whether the rule is active" },
                      trigger_type: { 
                        type: "string", 
                        enum: TRIGGER_TYPES,
                        description: "Type of trigger" 
                      },
                      trigger_config: {
                        type: "object",
                        properties: {
                          pipeline_id: { type: "string" },
                          stage_id: { type: "string" },
                          activity_type: { type: "string" }
                        }
                      },
                      conditions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            field: { type: "string" },
                            operator: { type: "string", enum: CONDITION_OPERATORS },
                            value: { type: "string" }
                          },
                          required: ["field", "operator", "value"]
                        }
                      },
                      actions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string", enum: ACTION_TYPES },
                            config: {
                              type: "object",
                              properties: {
                                target_stage_id: { type: "string" },
                                target_pipeline_id: { type: "string" },
                                title_prefix: { type: "string" },
                                loss_reason_id: { type: "string" },
                                activity_type: { type: "string", enum: ACTIVITY_TYPES },
                                title: { type: "string" },
                                description: { type: "string" },
                                days_offset: { type: "number" },
                                fields: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      name: { type: "string" },
                                      value: { type: "string" }
                                    }
                                  }
                                },
                                user_id: { type: "string" },
                                message: { type: "string" },
                                handoff_to_user_id: { type: "string" }
                              }
                            }
                          },
                          required: ["type", "config"]
                        }
                      }
                    }
                  },
                  clarification_message: {
                    type: "string",
                    description: "Message asking for clarification if the command is ambiguous"
                  },
                  confirmation_message: {
                    type: "string",
                    description: "Human-readable description of what will be done"
                  }
                },
                required: ["action", "confirmation_message"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_automation_command" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Por favor, recarregue sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar comando" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("AI Response:", JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ 
        error: "Não foi possível interpretar o comando. Tente ser mais específico." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedResult = JSON.parse(toolCall.function.arguments);
    console.log("Parsed result:", JSON.stringify(parsedResult, null, 2));

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-parse-automation-rule:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
