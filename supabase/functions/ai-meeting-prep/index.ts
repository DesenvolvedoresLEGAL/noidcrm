import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, meetingType } = await req.json();
    
    if (!opportunityId) {
      throw new Error('opportunityId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados completos
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(*),
        contact:contacts(*),
        stage:stages(*),
        activities(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;

    // Buscar timeline completa
    const { data: timeline } = await supabase
      .from('unified_timeline')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('timestamp', { ascending: false })
      .limit(30);

    // Buscar notas
    const { data: notes } = await supabase
      .from('opportunity_notes')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(10);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Prepare um briefing completo para uma reunião de vendas com base no histórico desta oportunidade.

Tipo de reunião: ${meetingType || 'discovery'}

Oportunidade:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Stage: ${opportunity.stage?.name}
- Status: ${opportunity.status}
- Temperatura: ${opportunity.temperature}

Cliente:
- Empresa: ${opportunity.account?.razao_social}
- Segmento: ${opportunity.account?.segmento}
- Tamanho: ${opportunity.account?.tamanho}
- Contato: ${opportunity.contact?.nome} (${opportunity.contact?.cargo})

Histórico:
- Total de interações: ${timeline?.length || 0}
- Notas registradas: ${notes?.length || 0}
- Atividades: ${opportunity.activities?.length || 0}

Últimas 3 interações:
${timeline?.slice(0, 3).map(t => `- ${t.title} (${t.type})`).join('\n') || 'Nenhuma'}

Retorne EXATAMENTE neste formato JSON:
{
  "executive_summary": "<resumo executivo da situação em 3-4 linhas>",
  "key_points": [
    "<ponto chave 1>",
    "<ponto chave 2>",
    "<ponto chave 3>"
  ],
  "talking_points": [
    {
      "topic": "<tópico>",
      "points": ["<ponto 1>", "<ponto 2>"],
      "questions": ["<pergunta 1>", "<pergunta 2>"]
    }
  ],
  "objectives": [
    "<objetivo 1>",
    "<objetivo 2>",
    "<objetivo 3>"
  ],
  "potential_objections": [
    {
      "objection": "<possível objeção>",
      "response": "<sugestão de resposta>"
    }
  ],
  "dos_and_donts": {
    "dos": ["<fazer 1>", "<fazer 2>"],
    "donts": ["<não fazer 1>", "<não fazer 2>"]
  },
  "next_steps_to_propose": [
    "<próximo passo 1>",
    "<próximo passo 2>"
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em preparação de reuniões de vendas B2B. Forneça briefings completos e acionáveis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    console.log('AI Meeting Prep generated:', aiResponse);

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-meeting-prep:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
