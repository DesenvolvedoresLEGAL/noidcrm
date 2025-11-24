import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId } = await req.json();
    
    if (!opportunityId) {
      throw new Error('opportunityId is required');
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
        stage:stages(*),
        activities(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;

    // Buscar últimas interações
    const { data: timeline } = await supabase
      .from('unified_timeline')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('timestamp', { ascending: false })
      .limit(10);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Com base no contexto desta oportunidade, sugira as 3-5 próximas melhores ações que o vendedor deve tomar para avançar a venda.

Dados da Oportunidade:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Stage atual: ${opportunity.stage?.name}
- Status: ${opportunity.status}
- Temperatura: ${opportunity.temperature}
- Dias sem contato: ${opportunity.days_since_contact || 0}
- Último contato: ${opportunity.last_contact_date || 'Nunca'}
- Próximo follow-up: ${opportunity.next_followup_date || 'Não agendado'}

Conta: ${opportunity.account?.razao_social} (${opportunity.account?.segmento})
Contato: ${opportunity.contact?.nome} (${opportunity.contact?.cargo})

Atividades recentes: ${opportunity.activities?.length || 0}
Última interação: ${timeline?.[0]?.title || 'Nenhuma'}

Retorne EXATAMENTE neste formato JSON:
{
  "actions": [
    {
      "priority": "<high|medium|low>",
      "type": "<call|email|meeting|proposal|follow-up>",
      "title": "<título da ação>",
      "description": "<descrição detalhada do que fazer>",
      "reason": "<por que esta ação é importante agora>",
      "timing": "<when to do it: now|today|this-week|next-week>",
      "estimated_impact": "<low|medium|high>"
    }
  ],
  "urgency_level": "<low|medium|high>",
  "overall_strategy": "<resumo da estratégia geral em 2-3 linhas>"
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
            content: 'Você é um especialista em estratégia de vendas B2B. Sugira ações práticas e acionáveis baseadas no contexto da oportunidade.'
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

    console.log('AI Next Action generated:', aiResponse);

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-next-action:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
