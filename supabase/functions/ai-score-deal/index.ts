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

    // Buscar dados da oportunidade e contexto
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

    // Buscar timeline unificada
    const { data: timeline } = await supabase
      .from('unified_timeline')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('timestamp', { ascending: false })
      .limit(20);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Analise esta oportunidade de vendas e forneça um score de probabilidade de ganhar (0-100) com insights detalhados.

Dados da Oportunidade:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Probabilidade atual: ${opportunity.prob}%
- Status: ${opportunity.status}
- Temperatura: ${opportunity.temperature}
- Stage: ${opportunity.stage?.name}
- Data prevista de fechamento: ${opportunity.close_date_prevista || 'Não definida'}
- Dias desde último contato: ${opportunity.days_since_contact || 0}

Conta:
- Razão Social: ${opportunity.account?.razao_social}
- Segmento: ${opportunity.account?.segmento}
- Tamanho: ${opportunity.account?.tamanho}

Atividades recentes: ${opportunity.activities?.length || 0} atividades
Timeline: ${timeline?.length || 0} interações registradas

Retorne EXATAMENTE neste formato JSON:
{
  "score": <número entre 0-100>,
  "confidence": "<low|medium|high>",
  "factors": {
    "positive": ["<fator positivo 1>", "<fator positivo 2>"],
    "negative": ["<fator negativo 1>", "<fator negativo 2>"],
    "neutral": ["<fator neutro 1>"]
  },
  "recommendations": ["<recomendação 1>", "<recomendação 2>", "<recomendação 3>"],
  "risk_level": "<low|medium|high>",
  "key_insights": "<resumo executivo de 2-3 linhas>"
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
            content: 'Você é um especialista em análise de vendas B2B. Analise oportunidades e forneça scores precisos baseados em dados históricos e contexto.'
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

    console.log('AI Deal Score generated:', aiResponse);

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-score-deal:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
