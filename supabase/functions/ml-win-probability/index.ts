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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current opportunity with full context
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(razao_social, nome_fantasia, segmento, tamanho, capital_social, cidade, uf, fit_score, intent_score, lead_score),
        contact:contacts(nome, cargo),
        stage:stages(name, order_index, probability)
      `)
      .eq('id', opportunityId)
      .maybeSingle();

    if (oppError) {
      console.error('Error fetching opportunity:', oppError);
      throw oppError;
    }
    
    if (!opportunity) {
      console.log('Opportunity not found:', opportunityId);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Opportunity not found',
        win_probability: null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get historical won opportunities (last 100)
    const { data: wonOpportunities } = await supabase
      .from('opportunities')
      .select(`
        valor_previsto, 
        prob,
        stage_id,
        created_at,
        updated_at,
        account:accounts(segmento, tamanho)
      `)
      .eq('organization_id', opportunity.organization_id)
      .eq('status', 'won')
      .order('updated_at', { ascending: false })
      .limit(100);

    // Get historical lost opportunities (last 100)
    const { data: lostOpportunities } = await supabase
      .from('opportunities')
      .select(`
        valor_previsto, 
        prob,
        stage_id,
        loss_reason_id,
        created_at,
        updated_at,
        account:accounts(segmento, tamanho),
        loss_reason:loss_reasons(name)
      `)
      .eq('organization_id', opportunity.organization_id)
      .eq('status', 'lost')
      .order('updated_at', { ascending: false })
      .limit(100);

    // Get activities count for current opportunity
    const { count: activitiesCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact' })
      .eq('opportunity_id', opportunityId);

    // Get proposals for current opportunity
    const { data: proposals } = await supabase
      .from('proposals')
      .select('status, value, view_count')
      .eq('opportunity_id', opportunityId);

    // Calculate days in pipeline
    const createdAt = new Date(opportunity.created_at);
    const now = new Date();
    const daysInPipeline = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Build prompt for AI analysis
    const prompt = `Você é um especialista em análise preditiva de vendas B2B. Analise os dados históricos e a oportunidade atual para calcular a probabilidade de ganho.

## HISTÓRICO DE GANHOS (${wonOpportunities?.length || 0} oportunidades):
${wonOpportunities?.slice(0, 30).map((o: any) => {
  const cycleDays = Math.floor((new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const acc = o.account as any;
  return `- Segmento: ${acc?.segmento || 'N/A'}, Tamanho: ${acc?.tamanho || 'N/A'}, Valor: R$ ${o.valor_previsto || 0}, Ciclo: ${cycleDays} dias, Prob final: ${o.prob}%`;
}).join('\n') || 'Sem dados históricos de ganhos'}

## HISTÓRICO DE PERDAS (${lostOpportunities?.length || 0} oportunidades):
${lostOpportunities?.slice(0, 30).map((o: any) => {
  const acc = o.account as any;
  const lr = o.loss_reason as any;
  return `- Segmento: ${acc?.segmento || 'N/A'}, Tamanho: ${acc?.tamanho || 'N/A'}, Valor: R$ ${o.valor_previsto || 0}, Motivo: ${lr?.name || 'N/A'}`;
}).join('\n') || 'Sem dados históricos de perdas'}

## OPORTUNIDADE ATUAL:
- Título: ${opportunity.title}
- Empresa: ${opportunity.account?.razao_social || opportunity.account?.nome_fantasia || 'N/A'}
- Segmento: ${opportunity.account?.segmento || 'N/A'}
- Tamanho: ${opportunity.account?.tamanho || 'N/A'}
- Capital Social: R$ ${opportunity.account?.capital_social || 0}
- Localização: ${opportunity.account?.cidade || 'N/A'}/${opportunity.account?.uf || 'N/A'}
- Valor Previsto: R$ ${opportunity.valor_previsto || 0}
- Probabilidade Atual: ${opportunity.prob}%
- Stage: ${opportunity.stage?.name || 'N/A'} (ordem ${opportunity.stage?.order_index || 0})
- Temperatura: ${opportunity.temperature || 'N/A'}
- Dias no Pipeline: ${daysInPipeline}
- Dias desde último contato: ${opportunity.days_since_contact || 0}
- Atividades realizadas: ${activitiesCount || 0}
- Propostas: ${proposals?.length || 0} (${proposals?.filter(p => p.status === 'sent').length || 0} enviadas)
- Visualizações de proposta: ${proposals?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0}

## SCORES DA CONTA:
- FIT Score: ${opportunity.account?.fit_score || 0}/100
- INTENT Score: ${opportunity.account?.intent_score || 0}/100
- Lead Score: ${opportunity.account?.lead_score || 0}/100

Analise os padrões históricos e compare com a oportunidade atual. Retorne um JSON com:
{
  "win_probability": <número 0-100 baseado na análise>,
  "confidence": "<low|medium|high>",
  "similar_won_patterns": ["<padrão 1 similar a ganhos>", "<padrão 2>"],
  "similar_lost_patterns": ["<padrão 1 similar a perdas>", "<padrão 2>"],
  "key_positive_factors": ["<fator positivo 1>", "<fator positivo 2>", "<fator positivo 3>"],
  "key_risk_factors": ["<risco 1>", "<risco 2>"],
  "recommendations": ["<ação recomendada 1>", "<ação recomendada 2>", "<ação recomendada 3>"],
  "reasoning": "<explicação de 2-3 linhas do cálculo>"
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
            content: 'Você é um especialista em análise preditiva de vendas B2B com anos de experiência. Analise dados históricos e forneça previsões precisas e acionáveis. Sempre responda em português brasileiro.'
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

    // Determine confidence level
    const confidence = aiResponse.confidence || 
      (wonOpportunities && wonOpportunities.length >= 50 ? 'high' : 
       wonOpportunities && wonOpportunities.length >= 20 ? 'medium' : 'low');

    // Update opportunity with AI prediction
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        win_probability_ai: aiResponse.win_probability,
        score_confidence: confidence
      })
      .eq('id', opportunityId);

    if (updateError) {
      console.error('Error updating win probability:', updateError);
    }

    // Log to score history
    await supabase
      .from('score_history')
      .insert({
        organization_id: opportunity.organization_id,
        entity_type: 'opportunity',
        entity_id: opportunityId,
        score_type: 'win_probability',
        old_value: opportunity.win_probability_ai || 0,
        new_value: aiResponse.win_probability,
        change_reason: 'ml_prediction',
        factors: {
          confidence,
          historical_won_count: wonOpportunities?.length || 0,
          historical_lost_count: lostOpportunities?.length || 0
        }
      });

    console.log('ML Win Probability calculated:', aiResponse.win_probability, '% with', confidence, 'confidence');

    return new Response(JSON.stringify({
      success: true,
      ...aiResponse,
      confidence
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ml-win-probability:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to calculate win probability' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
