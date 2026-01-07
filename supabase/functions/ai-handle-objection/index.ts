import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { opportunityId, objection, context } = await req.json();
    
    if (!opportunityId || !objection) {
      throw new Error('opportunityId and objection are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da oportunidade
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(*),
        contact:contacts(*),
        stage:stages(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const additionalContext = context ? `\n\nContexto adicional: ${context}` : '';

    const prompt = `Forneça estratégias para lidar com esta objeção de vendas no contexto da oportunidade.

Objeção do cliente: "${objection}"${additionalContext}

Contexto da Oportunidade:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Stage: ${opportunity.stage?.name}
- Status: ${opportunity.status}

Cliente:
- Empresa: ${opportunity.account?.razao_social}
- Segmento: ${opportunity.account?.segmento}
- Tamanho: ${opportunity.account?.tamanho}
- Contato: ${opportunity.contact?.nome} (${opportunity.contact?.cargo})

Retorne EXATAMENTE neste formato JSON:
{
  "objection_type": "<price|timing|competition|authority|need>",
  "severity": "<low|medium|high>",
  "recommended_approach": "<abordagem recomendada em 2-3 linhas>",
  "responses": [
    {
      "technique": "<nome da técnica de vendas>",
      "response": "<resposta sugerida>",
      "rationale": "<por que esta resposta funciona>",
      "follow_up_questions": ["<pergunta de follow-up 1>", "<pergunta 2>"]
    }
  ],
  "dos": [
    "<o que fazer 1>",
    "<o que fazer 2>"
  ],
  "donts": [
    "<o que não fazer 1>",
    "<o que não fazer 2>"
  ],
  "supporting_evidence": [
    "<evidência ou case que pode ajudar>"
  ],
  "alternative_approaches": [
    "<abordagem alternativa 1>",
    "<abordagem alternativa 2>"
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
            content: 'Você é um especialista em técnicas de vendas e handling de objeções. Forneça respostas práticas e baseadas em metodologias de vendas comprovadas.'
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

    console.log('AI Objection Handler response:', aiResponse);

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-handle-objection:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
