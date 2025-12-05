import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { member } = await req.json();
    
    if (!member) {
      return new Response(
        JSON.stringify({ error: 'Member data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Você é um coach de vendas experiente analisando a performance de um vendedor.
Analise os dados fornecidos e forneça recomendações de coaching personalizadas.

IMPORTANTE:
- Seja direto e prático nas recomendações
- Foque em ações específicas que o vendedor pode tomar
- Considere o contexto de vendas B2B
- Respostas em português brasileiro

Retorne APENAS um objeto JSON válido no seguinte formato (sem markdown, sem código):
{
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "improvement_areas": ["área de melhoria 1", "área de melhoria 2"],
  "recommendations": ["recomendação 1", "recomendação 2", "recomendação 3"]
}

Cada array deve ter 2-3 itens curtos e objetivos.`;

    const userPrompt = `Analise este vendedor:

Nome: ${member.name}
Oportunidades: ${member.opportunities_count}
Ganhas: ${member.won_count}
Perdidas: ${member.lost_count}
Taxa de Conversão: ${member.conversion_rate.toFixed(1)}%
Atividades Pendentes: ${member.activities_pending}
Atividades Concluídas: ${member.activities_completed}
Valor no Pipeline: R$ ${member.pipeline_value?.toLocaleString('pt-BR') || 0}
Valor Ganho: R$ ${member.won_value?.toLocaleString('pt-BR') || 0}

Gere coaching personalizado para este vendedor.`;

    console.log('Calling Lovable AI for coaching...');

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI response:', content);

    // Parse JSON from response
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback response
      parsed = {
        strengths: ['Demonstra comprometimento com metas', 'Potencial de crescimento identificado'],
        improvement_areas: ['Aumentar volume de atividades', 'Melhorar taxa de conversão'],
        recommendations: [
          'Fazer follow-up mais frequente com leads quentes',
          'Revisar técnicas de fechamento',
          'Aumentar número de reuniões semanais'
        ]
      };
    }

    return new Response(
      JSON.stringify({
        strengths: parsed.strengths || [],
        improvement_areas: parsed.improvement_areas || [],
        recommendations: parsed.recommendations || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-team-coaching:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
