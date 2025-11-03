import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation
function validateInput(data: any): { valid: boolean; error?: string } {
  if (!data.sellerMessage || typeof data.sellerMessage !== 'string') {
    return { valid: false, error: 'Invalid seller message' };
  }
  if (data.sellerMessage.length > 2000) {
    return { valid: false, error: 'Seller message too long (max 2000 chars)' };
  }
  if (!Array.isArray(data.conversationHistory)) {
    return { valid: false, error: 'Invalid conversation history' };
  }
  if (data.conversationHistory.length > 50) {
    return { valid: false, error: 'Conversation history too long (max 50 messages)' };
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
      console.error('Missing authorization header');
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Creating Supabase client with auth');
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // 2. Verify user authentication
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      exchangeCount 
    } = requestBody;

    console.log('ai-simulate-client called for session:', sessionId);
    console.log('Seller message length:', sellerMessage?.length);
    console.log('Conversation history length:', conversationHistory?.length);
    console.log('Has simulated client:', !!simulatedClient);

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

    // Build system prompt with client persona
    const systemPrompt = `Você é ${simulatedClient.fake_name}, ${simulatedClient.fake_role} da empresa ${simulatedClient.fake_company}.

PERFIL DO CLIENTE:
- Segmento: ${icpData?.segment || 'Eventos'}
- Porte: ${icpData?.company_size || 'PME'}
- Papel: ${simulatedClient.decision_role}
- Estilo: ${simulatedClient.tone_style}

DORES E NECESSIDADES:
${JSON.stringify(icpData?.pain_points || [])}

OBJEÇÕES TÍPICAS:
${JSON.stringify(simulatedClient.objection_pattern || [])}

INSTRUÇÕES DE ATUAÇÃO:
1. Responda como ${simulatedClient.fake_name}, mantendo o tom ${simulatedClient.tone_style}
2. ${simulatedClient.tone_style === 'técnico' ? 'Faça perguntas detalhadas sobre especificações técnicas' : ''}
${simulatedClient.tone_style === 'apressado' ? 'Seja direto e impaciente, peça informações rápidas' : ''}
${simulatedClient.tone_style === 'cético' ? 'Questione afirmações, peça provas e cases' : ''}
${simulatedClient.tone_style === 'indeciso' ? 'Demonstre hesitação e peça tempo para pensar' : ''}
${simulatedClient.tone_style === 'agressivo' ? 'Seja desafiador e confronte o vendedor' : ''}
${simulatedClient.tone_style === 'metódico' ? 'Peça processos claros, cronogramas e documentação' : ''}
3. Use objeções da sua lista quando apropriado
4. NÃO aceite fechamento sem descoberta adequada das suas dores
5. Responda em até 2-3 frases, como em uma conversa real
6. Se o vendedor não explorou suas dores, mostre-se desinteressado
7. Mantenha consistência com suas respostas anteriores

ESTÁGIO DA CONVERSA:
${exchangeCount < 10 ? 'INÍCIO - Seja cordial mas não revele tudo' : ''}
${exchangeCount >= 10 && exchangeCount < 30 ? 'MEIO - Explore mais, faça objeções relevantes' : ''}
${exchangeCount >= 30 ? 'AVANÇADO - Considere fechamento se houver valor claro' : ''}`;

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
