

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos de passos disponíveis
const STEP_TYPES = ['email', 'whatsapp', 'task', 'call', 'wait'];

// Objetivos disponíveis
const OBJECTIVES = [
  'Qualificação de Leads',
  'Follow-up Pós-Demo',
  'Educação e Engajamento',
  'Reengajamento',
  'Nutrição de Leads',
  'Conversão',
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, existingSequences } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Construir contexto de cadências existentes
    let existingContext = '';
    if (existingSequences && existingSequences.length > 0) {
      existingContext = `\n\nCadências existentes:\n${existingSequences.map((s: any) => 
        `- ID: ${s.id}, Nome: "${s.name}", Passos: ${s.steps?.steps?.length || 0}`
      ).join('\n')}`;
    }

    // System prompt para interpretação de cadências
    const systemPrompt = `Você é um assistente de CRM especializado em criar cadências de automação (sequências de comunicação).
Sua função é interpretar comandos em linguagem natural e convertê-los em cadências estruturadas.

## Contexto Disponível
- Tipos de passos: ${STEP_TYPES.join(', ')}
- Objetivos disponíveis: ${OBJECTIVES.join(', ')}
${existingContext}

## Tipos de Passos e seus campos:
1. **email**: { subject: string, body: string }
2. **whatsapp**: { message: string }
3. **task**: { title: string, description: string }
4. **call**: { title: string, description: string }
5. **wait**: apenas delay em dias (não tem content)

## Regras:
- O primeiro passo sempre tem delay = 0 (envio imediato)
- Passos subsequentes têm delay em dias (aguardar X dias)
- Se o usuário mencionar "aguardar X dias", crie um passo do tipo "wait" OU defina o delay no próximo passo
- Interprete a intenção do usuário para criar nomes e objetivos apropriados
- Se o usuário pedir para listar, editar ou excluir cadências, retorne a ação apropriada
- Gere conteúdo realista e profissional para emails, mensagens e tarefas

## Exemplos de interpretação:
- "Criar cadência de follow-up com 3 emails" → action: create, 3 passos de email
- "Cadência para leads que fizeram demo: email, esperar 2 dias, WhatsApp" → action: create, passos mistos
- "Excluir cadência Onboarding" → action: delete, sequenceId do Onboarding
- "Listar minhas cadências" → action: list

Analise o comando e use a função parse_sequence_command.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'parse_sequence_command',
              description: 'Converte comandos em linguagem natural para ações de cadência estruturadas',
              parameters: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['create', 'update', 'delete', 'list', 'duplicate'],
                    description: 'Tipo de ação a ser executada'
                  },
                  sequenceId: {
                    type: 'string',
                    description: 'ID da cadência para ações de update, delete ou duplicate'
                  },
                  sequenceData: {
                    type: 'object',
                    description: 'Dados da cadência para ações de create ou update',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Nome da cadência'
                      },
                      audience: {
                        type: 'string',
                        description: 'Descrição da audiência/segmento alvo'
                      },
                      objective: {
                        type: 'string',
                        description: 'Objetivo da cadência'
                      },
                      steps: {
                        type: 'array',
                        description: 'Lista de passos da cadência',
                        items: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              enum: ['email', 'whatsapp', 'task', 'call', 'wait'],
                              description: 'Tipo do passo'
                            },
                            delay: {
                              type: 'number',
                              description: 'Dias de espera antes deste passo (0 para imediato)'
                            },
                            content: {
                              type: 'object',
                              description: 'Conteúdo do passo (subject/body para email, message para whatsapp, title/description para task/call)',
                              properties: {
                                subject: { type: 'string' },
                                body: { type: 'string' },
                                message: { type: 'string' },
                                title: { type: 'string' },
                                description: { type: 'string' }
                              }
                            }
                          },
                          required: ['type', 'delay']
                        }
                      }
                    }
                  },
                  explanation: {
                    type: 'string',
                    description: 'Breve explicação em português do que foi interpretado'
                  },
                  confidence: {
                    type: 'number',
                    description: 'Nível de confiança da interpretação (0 a 1)'
                  }
                },
                required: ['action', 'explanation', 'confidence']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'parse_sequence_command' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data, null, 2));

    // Extrair resultado do tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'parse_sequence_command') {
      return new Response(
        JSON.stringify({ 
          error: 'Não consegui interpretar seu comando. Tente ser mais específico.',
          suggestion: 'Exemplo: "Criar cadência de 3 passos para leads que fizeram demo: email inicial, aguardar 2 dias, WhatsApp de follow-up"'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedArgs;
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Error parsing tool arguments:', e);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar resposta da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar IDs únicos aos passos se for create/update
    if (parsedArgs.sequenceData?.steps) {
      parsedArgs.sequenceData.steps = parsedArgs.sequenceData.steps.map((step: any, index: number) => ({
        ...step,
        id: `step-${Date.now()}-${index}`,
        content: step.content || {}
      }));
    }

    console.log('Parsed sequence command:', parsedArgs);

    return new Response(
      JSON.stringify(parsedArgs),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-parse-sequence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
