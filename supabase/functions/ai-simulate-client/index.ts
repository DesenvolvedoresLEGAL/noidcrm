import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://api.lovable.app/v1/ai/chat';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      sessionId,
      sellerMessage,
      conversationHistory,
      simulatedClient,
      icpData,
      archetypeData,
      exchangeCount 
    } = await req.json();

    console.log(`Generating AI response for session ${sessionId}, exchange #${exchangeCount}`);

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

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const clientResponse = aiData.choices[0].message.content.trim();

    console.log('AI Client response generated:', clientResponse.substring(0, 100) + '...');

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
    console.error('Error simulating client:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
