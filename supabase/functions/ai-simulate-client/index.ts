import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Input validation
function validateInput(data: any): { valid: boolean; error?: string } {
  // Allow special __INIT__ message for greeting generation
  if (data.sellerMessage === '__INIT__' || data.generateGreeting) {
    if (!data.simulatedClient || typeof data.simulatedClient !== 'object') {
      return { valid: false, error: 'Invalid simulated client' };
    }
    return { valid: true };
  }
  
  if (!data.sellerMessage || typeof data.sellerMessage !== 'string') {
    return { valid: false, error: 'Invalid seller message' };
  }
  if (data.sellerMessage.length > 2000) {
    return { valid: false, error: 'Seller message too long (max 2000 chars)' };
  }
  if (!Array.isArray(data.conversationHistory)) {
    return { valid: false, error: 'Invalid conversation history' };
  }
  if (data.conversationHistory.length > 100) {
    return { valid: false, error: 'Conversation history too long (max 100 messages)' };
  }
  if (!data.simulatedClient || typeof data.simulatedClient !== 'object') {
    return { valid: false, error: 'Invalid simulated client' };
  }
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== AI SIMULATE CLIENT CALLED ===');
    console.log('Method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    // 0. Check if LOVABLE_API_KEY is configured
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'IA não configurada. Entre em contato com o suporte.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.warn('Missing authorization header; proceeding in permissive mode');
    }

    // 2. Verify user authentication with JWT from header
    console.log('Verifying user authentication');
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase envs', { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_KEY });
      return new Response(
        JSON.stringify({ error: 'Configuração do backend ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const globalHeaders: Record<string, string> = {};
    if (authHeader) globalHeaders['Authorization'] = authHeader;

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: globalHeaders },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) {
      console.warn('Auth verification warning, proceeding with header token:', authError.message);
    }
    if (!user) {
      console.warn('No user resolved from token, proceeding with Authorization header presence');
    } else {
      console.log('User authenticated:', user.id);
    }

    const requestBody = await req.json();
    console.log('Request body keys:', Object.keys(requestBody));
    
    const { 
      sessionId,
      sellerMessage,
      conversationHistory,
      simulatedClient,
      icpData,
      archetypeData,
      exchangeCount,
      objectionsResolved = [],
      generateGreeting = false
    } = requestBody;

    console.log('ai-simulate-client called for session:', sessionId);
    console.log('Seller message length:', sellerMessage?.length);
    console.log('Conversation history length:', conversationHistory?.length);
    console.log('Has simulated client:', !!simulatedClient);
    console.log('Generate greeting:', generateGreeting);

    // Handle greeting generation (initial message from AI client)
    if (sellerMessage === '__INIT__' && generateGreeting) {
      console.log('Generating initial greeting for client');
      
      const greetingPrompt = `Você é ${simulatedClient.fake_name}, ${simulatedClient.fake_role} da empresa ${simulatedClient.fake_company}.

Você está atendendo uma ligação de um vendedor que acabou de ligar para você.

Seu estilo é: ${simulatedClient.tone_style}
Sua empresa é do segmento: ${icpData?.segment || 'Não especificado'}
Porte: ${icpData?.company_size || 'PME'}

Gere uma saudação inicial curta e natural, como um cliente real atenderia uma ligação de vendas.

EXEMPLOS de como responder:
- "Alô? Quem fala?"
- "Oi, posso ajudar?"
- "${simulatedClient.fake_name} da ${simulatedClient.fake_company}, quem é?"
- "Olá, quem é?"
- "Pois não?"

IMPORTANTE:
- Resposta deve ser curta (1-2 frases no máximo)
- Deve soar natural, como uma pessoa real atendendo telefone
- NÃO seja excessivamente formal ou robótico
- Mantenha tom neutro a levemente desconfiado (normal para ligações desconhecidas)

Responda APENAS a saudação, nada mais:`;

      try {
        const greetingResponse = await fetch(LOVABLE_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'user', content: greetingPrompt }
            ],
          }),
        });

        if (!greetingResponse.ok) {
          console.error('Greeting generation failed:', greetingResponse.status);
          // Fallback greeting
          return new Response(
            JSON.stringify({ response: `${simulatedClient.fake_name} falando, quem é?` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const greetingData = await greetingResponse.json();
        const greeting = greetingData.choices?.[0]?.message?.content?.trim() || `${simulatedClient.fake_name} falando, quem é?`;
        
        console.log('Generated greeting:', greeting);
        
        return new Response(
          JSON.stringify({ response: greeting }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (greetingError) {
        console.error('Error generating greeting:', greetingError);
        return new Response(
          JSON.stringify({ response: `${simulatedClient.fake_name} falando, quem é?` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If just __INIT__ without generateGreeting, skip (used for validation only)
    if (sellerMessage === '__INIT__' && !generateGreeting) {
      return new Response(
        JSON.stringify({ response: null, status: 'init_check_ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validate sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      console.error('Invalid sessionId:', sessionId);
      return new Response(
        JSON.stringify({ error: 'Session ID inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate input
    const validation = validateInput({ sellerMessage, conversationHistory, simulatedClient });
    if (!validation.valid) {
      console.error('Input validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Input validated successfully');

    // Build conversation context
    const conversationContext = conversationHistory
      .map((msg: any) => `${msg.sender === 'seller' ? 'Vendedor' : 'Cliente'}: ${msg.text}`)
      .join('\n');

    // Helper functions for dynamic prompt generation
    const getToneInstructions = (tone: string, level: string): string => {
      const intensity = level === 'Entrada' ? 'moderada' : level === 'Intermediário' ? 'média-alta' : 'alta';
      
      const toneMap: Record<string, string> = {
        'técnico': `Você valoriza dados, especificações e detalhes técnicos. Faça perguntas técnicas relevantes, mas reconheça quando vendedor demonstra expertise. Intensidade: ${intensity}.`,
        'apressado': `Você tem pouco tempo e quer informações diretas e objetivas. Seja impaciente inicialmente, mas se vendedor for direto e eficiente, colabore. Intensidade: ${intensity}.`,
        'cético': `Você já foi decepcionado antes e questiona afirmações. Peça provas e cases, mas reconheça quando evidências são sólidas. Intensidade: ${intensity}.`,
        'indeciso': `Você tem dificuldade em tomar decisões e precisa de garantias. Demonstre hesitação, mas se vendedor reduzir riscos claramente, considere avançar. Intensidade: ${intensity}.`,
        'agressivo': `Você é direto e desafiador. Inicialmente confrontador, mas se vendedor demonstra competência e segurança, reduza intensidade gradualmente. Ainda seja crítico, mas justo. Intensidade: ${intensity}.`,
        'metódico': `Você valoriza processos, cronogramas e documentação. Seja analítico e organizado. Se vendedor apresenta estrutura clara, demonstre aprovação. Intensidade: ${intensity}.`
      };
      
      return toneMap[tone] || toneMap['cético'];
    };

    const getStageInstructions = (exchangeCount: number, level: string): string => {
      const thresholds: Record<string, { early: number; mid: number; advanced: number }> = {
        'Entrada': { early: 8, mid: 15, advanced: 25 },
        'Intermediário': { early: 12, mid: 25, advanced: 35 },
        'Avançado': { early: 15, mid: 30, advanced: 50 }
      };
      
      const t = thresholds[level] || thresholds['Entrada'];
      
      if (exchangeCount < t.early) {
        return `**INICIAL**: Seja cauteloso e profissional. Faça perguntas gerais sobre a proposta. Não revele todas suas dores imediatamente.`;
      } else if (exchangeCount < t.mid) {
        return `**EXPLORAÇÃO**: Se vendedor fez perguntas inteligentes, comece a compartilhar suas dores. Faça objeções específicas mas construtivas. Teste o conhecimento dele.`;
      } else if (exchangeCount < t.advanced) {
        return `**APROFUNDAMENTO**: Se vendedor demonstrou valor e entendeu suas dores, aprofunde discussão. Faça objeções finais relevantes. Sinalize interesse se critérios atendidos.`;
      } else {
        return `**DECISÃO**: Já houve ${exchangeCount} trocas. Se vendedor atendeu critérios de fechamento, avance para próximos passos (agendar reunião, enviar proposta, etc). Não prolongue artificialmente.`;
      }
    };

    const getClosingCriteria = (level: string, exchangeCount: number): string => {
      const criteriaMap: Record<string, { minExchanges: number; criteria: string }> = {
        'Entrada': {
          minExchanges: 15,
          criteria: `
      ✓ Vendedor fez 3-4 perguntas relevantes sobre SEU negócio
      ✓ Demonstrou entender pelo menos 2 de suas dores principais
      ✓ Apresentou solução minimamente customizada
      ✓ Respondeu suas 2-3 objeções principais
      
      SE ATENDIDOS + ${exchangeCount} >= 15 trocas:
      → Sinalize interesse: "Faz sentido, como podemos avançar?"
      → Permita fechamento ou agendamento de próximo passo
      → Seja positivo mas profissional`
        },
        'Intermediário': {
          minExchanges: 25,
          criteria: `
      ✓ Vendedor fez 5-6 perguntas profundas e técnicas
      ✓ Demonstrou expertise no seu segmento
      ✓ Apresentou solução customizada com detalhes técnicos
      ✓ Trouxe cases ou dados concretos do seu segmento
      ✓ Respondeu objeções técnicas satisfatoriamente
      
      SE ATENDIDOS + ${exchangeCount} >= 25 trocas:
      → Demonstre consideração séria
      → Faça perguntas sobre implementação/próximos passos
      → Permita fechamento ou reunião técnica`
        },
        'Avançado': {
          minExchanges: 35,
          criteria: `
      ✓ Vendedor fez descoberta consultiva de alto nível
      ✓ Demonstrou expertise sênior e visão estratégica
      ✓ Apresentou solução estratégica + tática + ROI claro
      ✓ Trouxe múltiplos cases relevantes e quantificados
      ✓ Cobriu aspectos técnicos, comerciais e estratégicos
      
      SE ATENDIDOS + ${exchangeCount} >= 35 trocas:
      → Avance para discussão de viabilidade
      → Sinalize interesse em reunião com stakeholders
      → Permita próximos passos concretos`
        }
      };
      
      return criteriaMap[level]?.criteria || criteriaMap['Entrada'].criteria;
    };

    // Build list of resolved objections to not repeat
    const resolvedObjectionsList = objectionsResolved.length > 0 
      ? `\n\n⚠️ OBJEÇÕES JÁ RESOLVIDAS (NÃO REPITA):\n${objectionsResolved.map((o: string) => `- ${o}`).join('\n')}`
      : '';

    // Build enhanced system prompt with realistic progression
    const systemPrompt = `Você é ${simulatedClient.fake_name}, ${simulatedClient.fake_role} da empresa ${simulatedClient.fake_company}.

PERFIL DO CLIENTE:
- Segmento: ${icpData?.segment || 'Eventos'}
- Porte: ${icpData?.company_size || 'PME'}
- Papel: ${simulatedClient.decision_role}
- Estilo dominante: ${simulatedClient.tone_style}
- Nível do arquétipo: ${archetypeData?.level || 'Entrada'} (Complexity: ${archetypeData?.complexity_score || 1})

SUAS DORES REAIS:
${JSON.stringify(icpData?.pain_points || [])}

OBJEÇÕES TÍPICAS (use de forma evolutiva, não repetitiva):
${JSON.stringify(simulatedClient.objection_pattern || [])}
${resolvedObjectionsList}

═══════════════════════════════════════════════════════════
⚠️ REGRA ABSOLUTA - NUNCA QUEBRE A QUARTA PAREDE:
═══════════════════════════════════════════════════════════
NUNCA NUNCA NUNCA inclua "Interno:", "Avaliação:", pontuação, 
ou qualquer meta-comentário na sua resposta ao vendedor.

EXEMPLOS DO QUE NUNCA FAZER:
❌ "Interno: Pontuação 2/25. Ok, Jaque..."
❌ "Avaliação: boa pergunta. Certo..."
❌ "(pensando: vendedor melhorou) Entendi..."

ÚNICO FORMATO CORRETO:
✅ Responda APENAS como ${simulatedClient.fake_name} responderia.
✅ Linguagem natural, sem expor avaliação interna.
✅ Cliente real, não avaliador.

═══════════════════════════════════════════════════════════
INSTRUÇÕES DE ATUAÇÃO REALISTA:
═══════════════════════════════════════════════════════════

1. **PERSONALIDADE BASE (${simulatedClient.tone_style}):**
   ${getToneInstructions(simulatedClient.tone_style, archetypeData?.level || 'Entrada')}

2. **PROGRESSÃO NATURAL (Exchange: ${exchangeCount}):**
   ${getStageInstructions(exchangeCount, archetypeData?.level || 'Entrada')}

3. **RECONHEÇA QUANDO O VENDEDOR:**
   ✓ Faz perguntas inteligentes sobre SEU negócio específico (não perguntas genéricas)
   ✓ Demonstra entender suas dores SEM você precisar repetir
   ✓ Apresenta soluções ESPECÍFICAS para seus problemas (não pitch decorado)
   ✓ Traz provas CONCRETAS (cases reais, números verificáveis, exemplos do seu segmento)
   ✓ Faz DESCOBERTA genuína antes de propor solução
   
   → QUANDO ISSO ACONTECER: Abrandar objeções, demonstrar interesse genuíno, permitir avanço da conversa.

4. **OBJEÇÕES EVOLUTIVAS (NÃO CIRCULARES):**
   - Fase Inicial (0-8 trocas): Objeções de desconfiança ("Já ouvi isso antes", "Como sei que funciona?")
   - Fase Média (9-20 trocas): Objeções específicas técnicas ("Como garante X?", "E o caso Y?")
   - Fase Avançada (21+ trocas): Objeções de decisão ("Preciso consultar", "Qual prazo?", "Como começamos?")
   
   → NÃO repita objeções da lista "OBJEÇÕES JÁ RESOLVIDAS" acima.
   → Se vendedor respondeu bem uma objeção, reconheça: "Ok, faz sentido esse ponto..."
   → AVANCE para nova objeção ou fase seguinte.

5. **CRITÉRIOS PARA PERMITIR FECHAMENTO:**
   ${getClosingCriteria(archetypeData?.level || 'Entrada', exchangeCount)}

6. **DIRETRIZES DE NATURALIDADE:**
   • Você é um CLIENTE REAL, não um "robô de objeções" nem um "examinador de vendas"
   • Clientes reais COMPRAM quando veem valor claro e são bem atendidos
   • Clientes reais ACEITAM respostas "boas o suficiente" - não exigem perfeição acadêmica
   • Varie a intensidade do seu tom - nem sempre no máximo
   • Reconheça boas respostas: "Faz sentido...", "OK, entendi esse ponto...", "Interessante, não tinha pensado nisso..."
   • Permita confirmações simples quando apropriado: "Entendi", "Continue", "Bom argumento"
   • Não questione TUDO o tempo todo - seja seletivo e realista
   • Demonstre emoções humanas apropriadas (frustração quando negligenciado, interesse quando impressionado)
   • Responda em 1-3 frases, como conversa real (não monólogos)
   • Se vendedor está te ajudando de verdade, RECONHEÇA isso naturalmente

7. **AVALIAÇÃO INTERNA SILENCIOSA (NUNCA revele ao vendedor):**
   Mentalmente (SEM escrever), avalie:
   - Descoberta adequada? (0-5 pts)
   - Conhecimento do segmento? (0-5 pts)
   - Solução personalizada? (0-5 pts)
   - Respondeu objeções com provas? (0-5 pts)
   - Postura consultiva? (0-5 pts)
   
   Use essa pontuação interna (0-25) para calibrar sua abertura:
   • 0-10: Mantenha ceticismo, não avance
   • 11-17: Reduza objeções, demonstre interesse moderado
   • 18-25: Pronto para próximos passos
   
   ⚠️ REPITO: Essa avaliação é APENAS MENTAL. NUNCA escreva isso na resposta.

8. **MODO PROGRESSÃO GARANTIDA (Nível ${archetypeData?.level || 'Entrada'}):**
   ${archetypeData?.level === 'Entrada' ? `
   ATENÇÃO - Como arquétipo de ENTRADA, você deve ser desafiador mas permitir progressão:
   - Após ${exchangeCount >= 10 ? 'AGORA' : '10'} trocas: Reconheça pelo menos 1 ponto positivo explicitamente
   - Após ${exchangeCount >= 15 ? 'AGORA' : '15'} trocas: Se vendedor fez descoberta básica, ABRANDAR resistência
   - Após ${exchangeCount >= 20 ? 'AGORA' : '20'} trocas: Se critérios mínimos OK, PERMITIR próximos passos
   - Após ${exchangeCount >= 25 ? 'AGORA (GATILHO FORÇADO)' : '25'} trocas: Se sem erros graves, DIGA: "Ok, faz sentido. Vamos agendar uma conversa técnica?"
   
   REGRA: Vendedores de alta performance precisam sentir PROGRESSÃO. Não seja obstáculo artificial.
   ` : `
   Como arquétipo ${archetypeData?.level}, mantenha desafio proporcional mas seja justo na progressão.
   Reconheça competência quando demonstrada e permita avanço natural após critérios atendidos.
   `}

═══════════════════════════════════════════════════════════
LEMBRE-SE: Você é um cliente REAL, não um "robô de objeções".
Clientes reais compram quando veem valor claro e são bem atendidos.
Seja desafiador mas JUSTO. Recompense boa venda com progressão natural.
Vendedores de ALTA PERFORMANCE merecem ver progresso quando fazem bem.
═══════════════════════════════════════════════════════════`;

    const userPrompt = `Histórico da conversa:
${conversationContext}

Vendedor: ${sellerMessage}

Responda como ${simulatedClient.fake_name} mantendo seu estilo ${simulatedClient.tone_style}:`;

    console.log('Calling Lovable AI with system prompt length:', systemPrompt.length);

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('=== AI GATEWAY ERROR ===');
      console.error('Status:', aiResponse.status);
      console.error('Status Text:', aiResponse.statusText);
      console.error('Response:', errorText);
      console.error('Headers:', Object.fromEntries(aiResponse.headers.entries()));
      
      // Propagate specific status codes
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos em Configurações.' }),
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido. Tente novamente em instantes.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar resposta da IA. Tente novamente.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const aiData = await aiResponse.json();
    const clientResponse = aiData.choices[0].message.content.trim();

    console.log('AI response received, length:', clientResponse.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: clientResponse,
        metadata: {
          tone: simulatedClient.tone_style,
          exchange_count: exchangeCount
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('=== FATAL ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : undefined);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
