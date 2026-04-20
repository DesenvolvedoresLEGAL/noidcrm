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
    const { opportunityId } = await req.json();
    
    if (!opportunityId) {
      throw new Error('opportunityId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da oportunidade com pipeline para determinar tipo
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(*),
        contact:contacts(*),
        stage:stages(*),
        pipeline:pipelines(id, name, pipeline_type),
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

    // Determinar tipo de pipeline
    const pipelineType = opportunity.pipeline?.pipeline_type || 'sales';
    const isOperational = ['onboarding', 'customer_success'].includes(pipelineType);

    console.log('Pipeline type:', pipelineType, 'isOperational:', isOperational);

    // Calcular métricas básicas
    const daysSinceCreation = opportunity.created_at 
      ? Math.floor((Date.now() - new Date(opportunity.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    const completedActivities = opportunity.activities?.filter((a: any) => a.status === 'completed')?.length || 0;
    const totalActivities = opportunity.activities?.length || 0;

    let systemPrompt: string;
    let prompt: string;

    if (isOperational) {
      // Prompt para pipelines operacionais (Onboarding/CS)
      systemPrompt = `Você é um especialista em Customer Success e gestão de clientes B2B. 
Analise a saúde do relacionamento com o cliente e identifique riscos de churn, níveis de engajamento e progresso no onboarding.
IMPORTANTE: Este cliente JÁ FOI GANHO. A venda foi concluída. Foque em métricas de retenção e sucesso do cliente.`;

      prompt = `Analise este cliente em fase de pós-venda/onboarding e forneça uma análise de saúde do relacionamento.

Dados do Cliente:
- Empresa: ${opportunity.account?.razao_social || opportunity.title}
- Segmento: ${opportunity.account?.segmento || 'Não informado'}
- Tamanho: ${opportunity.account?.tamanho || 'Não informado'}
- Valor do contrato: R$ ${opportunity.valor_previsto || 0}

Status do Onboarding:
- Pipeline: ${opportunity.pipeline?.name}
- Fase atual: ${opportunity.stage?.name}
- Status: ${opportunity.status}
- Dias desde início: ${daysSinceCreation}
- Dias desde último contato: ${opportunity.days_since_contact || 0}

Engajamento:
- Atividades totais: ${totalActivities}
- Atividades concluídas: ${completedActivities}
- Interações na timeline: ${timeline?.length || 0}

Retorne EXATAMENTE neste formato JSON:
{
  "health_score": <número entre 0-100>,
  "churn_risk": "<low|medium|high>",
  "engagement_level": "<low|medium|high>",
  "onboarding_progress": <número entre 0-100>,
  "confidence": "<low|medium|high>",
  "factors": {
    "positive": ["<fator positivo 1>", "<fator positivo 2>"],
    "negative": ["<fator de risco 1>", "<fator de risco 2>"],
    "neutral": ["<observação neutra 1>"]
  },
  "recommendations": ["<ação recomendada 1>", "<ação recomendada 2>", "<ação recomendada 3>"],
  "key_insights": "<resumo executivo de 2-3 linhas sobre a saúde do cliente>"
}`;

    } else {
      // Prompt para pipelines de vendas (comportamento original)
      systemPrompt = 'Você é um especialista em análise de vendas B2B. Analise oportunidades e forneça scores precisos baseados em dados históricos e contexto.';

      prompt = `Analise esta oportunidade de vendas e forneça um score de probabilidade de ganhar (0-100) com insights detalhados.

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

Atividades recentes: ${totalActivities} atividades
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
    }

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
          { role: 'user', content: prompt }
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

    // Adicionar metadados do tipo de pipeline na resposta
    aiResponse.pipeline_type = pipelineType;
    aiResponse.is_operational = isOperational;

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
