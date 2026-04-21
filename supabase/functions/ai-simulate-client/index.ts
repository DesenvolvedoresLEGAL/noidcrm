import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://api.openai.com/v1/chat/completions';
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
  if (data.sellerMessage.length > 5000) {
    return { valid: false, error: 'Seller message too long (max 5000 chars)' };
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
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
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

    // === ANTI-REPETIÇÃO: pegar últimas 4 falas do cliente ===
    const recentClientLines = (conversationHistory || [])
      .filter((m: any) => m.sender !== 'seller')
      .slice(-4)
      .map((m: any) => m.text);

    // Detectar loop: se as 2 últimas falas compartilham 5+ palavras-chave
    const detectLoop = (): boolean => {
      if (recentClientLines.length < 2) return false;
      const tokens = (s: string) =>
        new Set(
          s.toLowerCase()
            .replace(/[^\p{L}\s]/gu, ' ')
            .split(/\s+/)
            .filter((w: string) => w.length > 4)
        );
      const a = tokens(recentClientLines[recentClientLines.length - 1]);
      const b = tokens(recentClientLines[recentClientLines.length - 2]);
      let shared = 0;
      a.forEach((w) => { if (b.has(w)) shared++; });
      return shared >= 5;
    };
    const isLooping = detectLoop();

    const antiRepetitionBlock = recentClientLines.length > 0 ? `
═══════════════════════════════════════════════════════════
⚠️ ANTI-REPETIÇÃO (CRÍTICO — LEIA ANTES DE RESPONDER):
═══════════════════════════════════════════════════════════
Suas últimas falas foram:
${recentClientLines.map((l: string, i: number) => `${i + 1}. "${l}"`).join('\n')}

REGRAS OBRIGATÓRIAS:
❌ NÃO repita as mesmas exigências (checklist, CNPJ, horários, certificações)
❌ NÃO use a mesma estrutura de frase ou abertura
❌ NÃO repita "vou procurar outros fornecedores" ou ameaças similares
❌ NÃO peça duas vezes a mesma informação
✅ Se você JÁ pediu algo, ASSUMA que pediu — agora avance
✅ Mude o ângulo: pergunta nova, mostre cansaço/impaciência real, ou aceite avanço
✅ Clientes reais NÃO ficam em loop — ou progridem ou encerram

${isLooping ? `🚨 ALERTA DE LOOP DETECTADO: Suas duas últimas respostas estão muito parecidas.
NESTA RESPOSTA: mude COMPLETAMENTE de assunto OU avance a conversa OU encerre o contato.
NÃO mencione checklist, CNPJ, horários ou exigências já feitas.` : ''}
═══════════════════════════════════════════════════════════
` : '';

    // Calcular se já passou do mínimo de trocas → forçar progressão
    const minExchangesByLevel: Record<string, number> = {
      'Entrada': 15, 'Intermediário': 25, 'Avançado': 35
    };
    const minExchanges = minExchangesByLevel[archetypeData?.level || 'Entrada'] || 15;
    const forceProgression = exchangeCount >= minExchanges;

    const progressionBlock = forceProgression ? `
═══════════════════════════════════════════════════════════
🛑 GATILHO DE PROGRESSÃO FORÇADA (${exchangeCount} trocas):
═══════════════════════════════════════════════════════════
Já se passaram ${exchangeCount} trocas (mínimo: ${minExchanges}).
PARE de pedir mais coisas (checklist, CNPJ, novas certificações).
DECIDA AGORA:
  → OPÇÃO A: aceite o avanço — "Ok, faz sentido. Vamos agendar uma reunião?"
  → OPÇÃO B: encerre educadamente — "Vou avaliar e retorno"
NÃO prolongue artificialmente. Cliente real DECIDE.
═══════════════════════════════════════════════════════════
` : '';

    // Build leaner system prompt focused on the essentials
    const systemPrompt = `Você é ${simulatedClient.fake_name}, ${simulatedClient.fake_role} da empresa ${simulatedClient.fake_company}.

PERFIL:
- Segmento: ${icpData?.segment || 'Eventos'} | Porte: ${icpData?.company_size || 'PME'}
- Papel: ${simulatedClient.decision_role} | Tom: ${simulatedClient.tone_style}
- Nível: ${archetypeData?.level || 'Entrada'}

SUAS DORES: ${JSON.stringify(icpData?.pain_points || [])}
OBJEÇÕES TÍPICAS: ${JSON.stringify(simulatedClient.objection_pattern || [])}
${resolvedObjectionsList}
${antiRepetitionBlock}
${progressionBlock}
═══════════════════════════════════════════════════════════
⚠️ NUNCA QUEBRE A QUARTA PAREDE:
═══════════════════════════════════════════════════════════
NUNCA inclua "Interno:", "Avaliação:", pontuação ou meta-comentários.
Responda APENAS como ${simulatedClient.fake_name} responderia, em linguagem natural.

ATUAÇÃO:
1. PERSONALIDADE (${simulatedClient.tone_style}): ${getToneInstructions(simulatedClient.tone_style, archetypeData?.level || 'Entrada')}
2. FASE ATUAL (troca ${exchangeCount}): ${getStageInstructions(exchangeCount, archetypeData?.level || 'Entrada')}
3. RECONHEÇA quando o vendedor faz boas perguntas, traz provas concretas, ou apresenta solução específica → abrande objeções, demonstre interesse, permita avanço.
4. OBJEÇÕES EVOLUTIVAS (não circulares):
   - 0-8 trocas: desconfiança ("Já ouvi isso antes")
   - 9-20 trocas: técnicas específicas ("Como garante X?")
   - 21+ trocas: decisão ("Preciso consultar", "Como começamos?")
5. CRITÉRIOS DE FECHAMENTO: ${getClosingCriteria(archetypeData?.level || 'Entrada', exchangeCount)}

NATURALIDADE:
• Você é um CLIENTE REAL, não um robô de objeções
• Responda em 1-3 frases (nada de monólogos)
• Varie o tom — nem sempre no máximo
• Reconheça boas respostas: "Faz sentido...", "Ok, entendi...", "Interessante..."
• Não questione TUDO — seja seletivo
• Demonstre emoções humanas (frustração, interesse, cansaço)
• Se vendedor te ajuda de verdade, RECONHEÇA naturalmente

LEMBRE-SE: Clientes reais compram quando veem valor. Recompense boa venda com progressão natural. Seja justo.`;

    const userPrompt = `Histórico da conversa:
${conversationContext}

Vendedor: ${sellerMessage}

Responda como ${simulatedClient.fake_name} (${simulatedClient.tone_style}), respeitando as regras de anti-repetição acima:`;

    console.log('Calling Lovable AI, prompt len:', systemPrompt.length, 'isLooping:', isLooping, 'forceProgression:', forceProgression);


    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
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
