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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: orgId } = await supabase.rpc('get_user_organization_id');
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'User has no organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { insightType = 'general' } = await req.json();

    // Fetch pipeline metrics
    const { data: pipelineMetrics } = await supabase
      .from('pipeline_metrics')
      .select('*')
      .limit(10);

    // Fetch pipeline health
    const { data: pipelineHealth } = await supabase
      .from('pipeline_health')
      .select('*')
      .limit(10);

    // Fetch recent opportunities
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('id, title, valor_previsto, status, created_at, close_date_prevista, temperature, opportunity_score, win_probability_ai')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch stage conversion metrics
    const { data: stageConversion } = await supabase
      .from('stage_conversion_metrics')
      .select('*')
      .limit(20);

    // Calculate summary stats
    const openOpps = opportunities?.filter(o => !['won', 'lost'].includes(o.status || '')) || [];
    const wonOpps = opportunities?.filter(o => o.status === 'won') || [];
    const lostOpps = opportunities?.filter(o => o.status === 'lost') || [];
    
    const totalPipelineValue = openOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    const avgDealSize = wonOpps.length > 0 
      ? wonOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) / wonOpps.length 
      : 0;
    const winRate = (wonOpps.length + lostOpps.length) > 0 
      ? (wonOpps.length / (wonOpps.length + lostOpps.length)) * 100 
      : 0;

    const dataContext = {
      pipelineMetrics: pipelineMetrics || [],
      pipelineHealth: pipelineHealth || [],
      stageConversion: stageConversion || [],
      summary: {
        totalOpenOpportunities: openOpps.length,
        totalPipelineValue,
        avgDealSize,
        winRate: winRate.toFixed(1),
        wonCount: wonOpps.length,
        lostCount: lostOpps.length,
        hotDeals: openOpps.filter(o => o.temperature === 'hot' || o.temperature === 'burning').length,
        atRiskDeals: openOpps.filter(o => (o.opportunity_score || 0) < 40).length
      }
    };

    const systemPrompt = `Você é um analista de vendas especializado em CRM e inteligência comercial. 
Analise os dados fornecidos e gere insights acionáveis em português brasileiro.

Tipo de análise solicitada: ${insightType}

Formate sua resposta como JSON com a seguinte estrutura:
{
  "summary": "Resumo executivo em 2-3 frases",
  "insights": [
    {
      "type": "success" | "warning" | "opportunity" | "risk",
      "title": "Título do insight",
      "description": "Descrição detalhada",
      "recommendation": "Ação recomendada",
      "impact": "high" | "medium" | "low"
    }
  ],
  "kpis": [
    {
      "label": "Nome do KPI",
      "value": "Valor formatado",
      "trend": "up" | "down" | "stable",
      "context": "Contexto breve"
    }
  ],
  "predictions": [
    {
      "metric": "Nome da métrica",
      "prediction": "Previsão",
      "confidence": "high" | "medium" | "low",
      "timeframe": "Período"
    }
  ]
}

Gere entre 3-6 insights relevantes baseados nos dados.
Foque em insights acionáveis que ajudem a equipe de vendas a melhorar performance.
Identifique padrões, riscos e oportunidades nos dados.`;

    const userPrompt = `Analise os seguintes dados de vendas e gere insights:

${JSON.stringify(dataContext, null, 2)}

Gere insights focados em:
1. Performance geral do pipeline
2. Oportunidades em risco
3. Padrões de conversão
4. Recomendações de ação imediata
5. Previsões baseadas nos dados`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('AI service unavailable');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    let insights;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      insights = {
        summary: 'Análise de dados em processamento',
        insights: [{
          type: 'opportunity',
          title: 'Dados Analisados',
          description: content.substring(0, 500),
          recommendation: 'Revise os dados do pipeline',
          impact: 'medium'
        }],
        kpis: [],
        predictions: []
      };
    }

    return new Response(JSON.stringify({
      success: true,
      data: insights,
      generatedAt: new Date().toISOString(),
      dataContext: dataContext.summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-bi-insights:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
