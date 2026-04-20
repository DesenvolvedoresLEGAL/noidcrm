import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RevenueImpactRequest {
  organizationId: string;
  period?: 'month' | 'quarter' | 'year';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, period = 'year' } = await req.json() as RevenueImpactRequest;

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organizationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[calculate-revenue-impact] Calculating for org: ${organizationId}, period: ${period}`);

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Fetch win/loss records
    const { data: records, error: recordsError } = await supabase
      .from('win_loss_records')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString());

    if (recordsError) {
      console.error('[calculate-revenue-impact] Error fetching records:', recordsError);
      throw recordsError;
    }

    const wins = records?.filter(r => r.outcome === 'won') || [];
    const losses = records?.filter(r => r.outcome === 'lost') || [];
    const totalDeals = wins.length + losses.length;

    if (totalDeals === 0) {
      return new Response(JSON.stringify({
        success: true,
        simulation: null,
        message: 'Não há dados suficientes para simular impacto'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate current metrics
    const currentWinRate = totalDeals > 0 ? (wins.length / totalDeals) * 100 : 0;
    const currentRevenue = wins.reduce((sum, w) => sum + (w.final_value || 0), 0);
    const lostRevenue = losses.reduce((sum, l) => sum + (l.final_value || 0), 0);
    const avgDealValue = totalDeals > 0 ? (currentRevenue + lostRevenue) / totalDeals : 0;

    // Analyze loss factors
    const lossFactors = {
      price: losses.filter(l => l.price_factor).length,
      timing: losses.filter(l => l.timing_factor).length,
      feature: losses.filter(l => l.feature_factor).length,
      relationship: losses.filter(l => l.relationship_factor).length
    };

    // Generate improvements based on loss analysis
    const improvements = [];
    let potentialWinRateIncrease = 0;

    if (lossFactors.price > losses.length * 0.3) {
      improvements.push({
        area: 'Precificação',
        description: 'Revisar estratégia de preços e oferecer opções flexíveis',
        potentialImpact: 3,
        difficulty: 'medium'
      });
      potentialWinRateIncrease += 3;
    }

    if (lossFactors.feature > losses.length * 0.25) {
      improvements.push({
        area: 'Produto',
        description: 'Priorizar desenvolvimento de features mais solicitadas',
        potentialImpact: 4,
        difficulty: 'high'
      });
      potentialWinRateIncrease += 4;
    }

    if (lossFactors.timing > losses.length * 0.2) {
      improvements.push({
        area: 'Processo de Vendas',
        description: 'Acelerar ciclo de vendas e melhorar follow-up',
        potentialImpact: 2,
        difficulty: 'low'
      });
      potentialWinRateIncrease += 2;
    }

    if (lossFactors.relationship > losses.length * 0.15) {
      improvements.push({
        area: 'Relacionamento',
        description: 'Investir em treinamento de vendedores e relacionamento',
        potentialImpact: 3,
        difficulty: 'medium'
      });
      potentialWinRateIncrease += 3;
    }

    // Calculate projected metrics
    const projectedWinRate = Math.min(currentWinRate + potentialWinRateIncrease, 95);
    const additionalWins = Math.round(losses.length * (potentialWinRateIncrease / 100));
    const projectedRevenue = currentRevenue + (additionalWins * avgDealValue);
    const revenueIncrement = projectedRevenue - currentRevenue;

    // Generate AI recommendations if API key available
    let aiAnalysis = null;
    const recommendations = [];

    if (lovableApiKey && totalDeals >= 5) {
      try {
        const prompt = `Analise os seguintes dados de Win/Loss e forneça 3 recomendações estratégicas:

Dados:
- Win Rate Atual: ${currentWinRate.toFixed(1)}%
- Total de Deals: ${totalDeals}
- Ganhos: ${wins.length} (R$ ${currentRevenue.toFixed(0)})
- Perdas: ${losses.length} (R$ ${lostRevenue.toFixed(0)})
- Fator Preço: ${lossFactors.price} perdas
- Fator Feature: ${lossFactors.feature} perdas
- Fator Timing: ${lossFactors.timing} perdas
- Fator Relacionamento: ${lossFactors.relationship} perdas

Forneça recomendações em JSON: { "recommendations": [{ "area": "...", "action": "...", "expectedImpact": "...", "priority": "high|medium|low" }] }`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            recommendations.push(...(parsed.recommendations || []));
          }
          
          aiAnalysis = content;
        }
      } catch (aiError) {
        console.error('[calculate-revenue-impact] AI analysis error:', aiError);
      }
    }

    // Save simulation to database
    const { data: simulation, error: saveError } = await supabase
      .from('winloss_revenue_simulations')
      .insert({
        organization_id: organizationId,
        current_win_rate: currentWinRate,
        projected_win_rate: projectedWinRate,
        current_revenue: currentRevenue,
        projected_revenue: projectedRevenue,
        revenue_increment: revenueIncrement,
        improvements,
        recommendations,
        ai_analysis: aiAnalysis
      })
      .select()
      .single();

    if (saveError) {
      console.error('[calculate-revenue-impact] Error saving simulation:', saveError);
    }

    console.log(`[calculate-revenue-impact] Simulation complete. Win rate: ${currentWinRate.toFixed(1)}% → ${projectedWinRate.toFixed(1)}%`);

    return new Response(JSON.stringify({
      success: true,
      simulation: {
        id: simulation?.id,
        period,
        metrics: {
          currentWinRate,
          projectedWinRate,
          currentRevenue,
          projectedRevenue,
          revenueIncrement,
          totalDeals,
          wins: wins.length,
          losses: losses.length,
          avgDealValue,
          lostRevenue
        },
        lossFactors,
        improvements,
        recommendations,
        aiAnalysis
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[calculate-revenue-impact] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
