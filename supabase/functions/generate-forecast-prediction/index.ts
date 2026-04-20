import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { organization_id, pipeline_id, forecast_type = 'quarterly' } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate period dates
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const periodEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);

    // Fetch open opportunities
    let query = supabase
      .from('opportunities')
      .select(`
        id, titulo, valor_previsto, prob, temperature, status, created_at,
        close_date_prevista, stage_id, pipeline_id,
        pipelines!inner(id, name, pipeline_type)
      `)
      .eq('organization_id', organization_id)
      .in('status', ['open', 'negotiation', 'proposal']);

    if (pipeline_id) {
      query = query.eq('pipeline_id', pipeline_id);
    } else {
      query = query.eq('pipelines.pipeline_type', 'sales');
    }

    const { data: opportunities, error: oppError } = await query;

    if (oppError) {
      console.error('Error fetching opportunities:', oppError);
      throw oppError;
    }

    // Fetch historical win/loss data
    const { data: historicalData } = await supabase
      .from('opportunities')
      .select('valor_previsto, status, updated_at')
      .eq('organization_id', organization_id)
      .in('status', ['won', 'lost'])
      .gte('updated_at', new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString());

    // Fetch closed revenue this period
    const { data: closedRevenue } = await supabase
      .from('opportunities')
      .select('valor_previsto')
      .eq('organization_id', organization_id)
      .eq('status', 'won')
      .gte('updated_at', periodStart.toISOString())
      .lte('updated_at', periodEnd.toISOString());

    // Calculate metrics
    const totalPipeline = opportunities?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
    const weightedPipeline = opportunities?.reduce((sum, o) => sum + ((o.valor_previsto || 0) * (o.prob || 0) / 100), 0) || 0;
    const closedValue = closedRevenue?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
    
    const wonDeals = historicalData?.filter(d => d.status === 'won') || [];
    const lostDeals = historicalData?.filter(d => d.status === 'lost') || [];
    const winRate = wonDeals.length + lostDeals.length > 0 
      ? wonDeals.length / (wonDeals.length + lostDeals.length) 
      : 0.3;

    // Temperature distribution
    const tempDist = {
      burning: opportunities?.filter(o => o.temperature === 'burning').length || 0,
      hot: opportunities?.filter(o => o.temperature === 'hot').length || 0,
      warm: opportunities?.filter(o => o.temperature === 'warm').length || 0,
      cold: opportunities?.filter(o => o.temperature === 'cold').length || 0,
    };

    // Input data for AI
    const inputData = {
      totalPipeline,
      weightedPipeline,
      closedValue,
      winRate,
      opportunityCount: opportunities?.length || 0,
      temperatureDistribution: tempDist,
      avgDealSize: opportunities?.length ? totalPipeline / opportunities.length : 0,
      periodDaysRemaining: Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    };

    // Calculate base scenarios
    const pessimisticValue = closedValue + (weightedPipeline * 0.6);
    const realisticValue = closedValue + (weightedPipeline * 0.85);
    const optimisticValue = closedValue + (weightedPipeline * 1.1) + (totalPipeline - weightedPipeline) * 0.2;

    let aiReasoning = '';
    let factors: any[] = [];
    let recommendations: any[] = [];
    let confidence = 70;

    // Use AI for enhanced prediction if available
    if (lovableApiKey) {
      try {
        const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const prompt = `CONTEXTO TEMPORAL: Hoje é ${todayISO}. Analise os seguintes dados de pipeline de vendas e forneça uma previsão de forecast:

DADOS DO PIPELINE:
- Pipeline Total: R$ ${totalPipeline.toLocaleString('pt-BR')}
- Pipeline Ponderado: R$ ${weightedPipeline.toLocaleString('pt-BR')}
- Receita Fechada no Período: R$ ${closedValue.toLocaleString('pt-BR')}
- Taxa de Conversão Histórica: ${(winRate * 100).toFixed(1)}%
- Oportunidades Ativas: ${inputData.opportunityCount}
- Ticket Médio: R$ ${inputData.avgDealSize.toLocaleString('pt-BR')}
- Dias Restantes no Período: ${inputData.periodDaysRemaining}

DISTRIBUIÇÃO POR TEMPERATURA:
- Burning (urgente): ${tempDist.burning}
- Hot (quente): ${tempDist.hot}
- Warm (morna): ${tempDist.warm}
- Cold (fria): ${tempDist.cold}

CENÁRIOS CALCULADOS:
- Pessimista: R$ ${pessimisticValue.toLocaleString('pt-BR')}
- Realista: R$ ${realisticValue.toLocaleString('pt-BR')}
- Otimista: R$ ${optimisticValue.toLocaleString('pt-BR')}

Responda em JSON com a estrutura:
{
  "reasoning": "Análise detalhada em português",
  "confidence": número de 0-100,
  "factors": [{"type": "positive|negative|neutral", "description": "fator"}],
  "recommendations": [{"priority": "high|medium|low", "action": "ação recomendada"}],
  "adjustedPessimistic": número,
  "adjustedRealistic": número,
  "adjustedOptimistic": número
}`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: 'Você é um especialista em forecast de vendas B2B. Analise dados e forneça previsões precisas.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              aiReasoning = parsed.reasoning || '';
              factors = parsed.factors || [];
              recommendations = parsed.recommendations || [];
              confidence = parsed.confidence || 70;
            }
          } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            aiReasoning = content;
          }

          // Log AI usage
          await supabase.from('ai_usage_logs').insert({
            organization_id,
            user_id: user.id,
            feature: 'forecast',
            action: 'generate_prediction',
            model_used: 'gpt-5-mini',
            tokens_input: aiData.usage?.prompt_tokens || 0,
            tokens_output: aiData.usage?.completion_tokens || 0,
            tokens_total: aiData.usage?.total_tokens || 0,
            success: true,
          });
        }
      } catch (aiError) {
        console.error('AI prediction error:', aiError);
      }
    }

    // Store forecast log
    const { data: forecastLog, error: logError } = await supabase
      .from('ai_forecast_logs')
      .insert({
        organization_id,
        user_id: user.id,
        pipeline_id,
        forecast_type,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        pessimistic_value: pessimisticValue,
        realistic_value: realisticValue,
        optimistic_value: optimisticValue,
        confidence_score: confidence,
        model_version: 'v1',
        input_data: inputData,
        ai_reasoning: aiReasoning,
        factors,
        recommendations,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error storing forecast log:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      forecast: {
        id: forecastLog?.id,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        scenarios: {
          pessimistic: pessimisticValue,
          realistic: realisticValue,
          optimistic: optimisticValue,
        },
        confidence,
        closedValue,
        totalPipeline,
        weightedPipeline,
        winRate,
        aiReasoning,
        factors,
        recommendations,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-forecast-prediction:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
