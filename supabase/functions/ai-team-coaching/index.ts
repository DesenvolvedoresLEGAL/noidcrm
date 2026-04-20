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
    const body = await req.json();
    
    // Support both old format (member) and new format (sellerId, sellerName, metrics)
    const member = body.member;
    const sellerId = body.sellerId;
    const sellerName = body.sellerName || member?.name;
    const metrics = body.metrics || member;

    if (!sellerName && !member) {
      return new Response(
        JSON.stringify({ error: 'Member or seller data is required' }),
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

    const name = sellerName || member?.name;
    const m = metrics || member;

    const systemPrompt = `Você é um coach de vendas sênior especializado em análise de performance, desenvolvimento de equipes comerciais e metodologias modernas de vendas B2B. Você conhece técnicas como SPIN Selling, Challenger Sale, Sandler, MEDDIC, e metodologias de qualificação como BANT e GPCT.

IMPORTANTE:
- Seja direto e prático nas recomendações
- Foque em ações específicas que o vendedor pode tomar
- Considere o contexto de vendas B2B
- Respostas em português brasileiro

Retorne APENAS um objeto JSON válido no seguinte formato (sem markdown, sem código):
{
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "gaps": ["gap 1", "gap 2"],
  "recommendations": ["recomendação 1", "recomendação 2", "recomendação 3", "recomendação 4"],
  "strategies": ["estratégia 1", "estratégia 2", "estratégia 3"],
  "training_materials": ["material 1", "material 2", "material 3"],
  "priority_actions": ["ação 1", "ação 2"]
}`;

    const userPrompt = `Analise este vendedor e forneça coaching completo:

Nome: ${name}
Oportunidades ativas: ${m.opportunities_count || 0}
Valor do pipeline: R$ ${(m.pipeline_value || 0).toLocaleString('pt-BR')}
Valor ganho no período: R$ ${(m.won_value || 0).toLocaleString('pt-BR')}
Atividades realizadas: ${m.activities_count || m.activities_completed || 0}
Taxa de conversão: ${(m.conversion_rate || 0).toFixed(1)}%
Progresso da meta: ${(m.goal_progress || 0).toFixed(1)}%
${m.team_goal ? `Meta do time: R$ ${m.team_goal.toLocaleString('pt-BR')}` : ''}
${m.won_count !== undefined ? `Oportunidades ganhas: ${m.won_count}` : ''}
${m.lost_count !== undefined ? `Oportunidades perdidas: ${m.lost_count}` : ''}
${m.activities_pending !== undefined ? `Atividades pendentes: ${m.activities_pending}` : ''}

Gere coaching personalizado com:
- Pontos fortes baseados nos números
- Gaps ou áreas de melhoria
- Recomendações específicas e acionáveis
- Estratégias de abordagem de vendas
- Materiais de treinamento recomendados
- Ações prioritárias para os próximos 7 dias`;

    console.log('Calling Lovable AI for coaching...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Contate o administrador.' }),
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      parsed = {
        strengths: ['Engajamento ativo no CRM', 'Registro consistente de atividades'],
        gaps: ['Dados insuficientes para análise detalhada', 'Continue registrando para insights mais precisos'],
        recommendations: [
          'Mantenha o registro diário de atividades',
          'Atualize o status das oportunidades regularmente',
          'Documente feedback de clientes',
          'Faça follow-up em leads quentes'
        ],
        strategies: [
          'Use perguntas abertas para descobrir dores do cliente',
          'Apresente cases de sucesso relevantes',
          'Crie senso de urgência com ofertas limitadas'
        ],
        training_materials: [
          'SPIN Selling - Técnicas de Perguntas',
          'Gestão Eficiente de Pipeline',
          'Negociação e Fechamento'
        ],
        priority_actions: [
          'Revisar todas as oportunidades em aberto',
          'Fazer follow-up em deals parados há mais de 7 dias'
        ]
      };
    }

    // Ensure all fields exist with defaults
    const result = {
      strengths: parsed.strengths || ['Demonstra comprometimento com metas'],
      gaps: parsed.gaps || parsed.improvement_areas || ['Aumentar volume de atividades'],
      recommendations: parsed.recommendations || ['Fazer follow-up mais frequente'],
      strategies: parsed.strategies || ['Use técnicas de qualificação BANT'],
      training_materials: parsed.training_materials || ['Técnicas de Fechamento'],
      priority_actions: parsed.priority_actions || ['Revisar pipeline'],
      // Keep backward compatibility
      improvement_areas: parsed.improvement_areas || parsed.gaps || []
    };

    return new Response(
      JSON.stringify(result),
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
