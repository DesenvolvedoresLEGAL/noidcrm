import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WinLossInsight {
  type: 'pattern' | 'recommendation' | 'alert';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, dateRange } = await req.json();
    
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate date range
    const now = new Date();
    let startDate: string;
    
    switch (dateRange) {
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }

    // Fetch win/loss records
    const { data: records, error: recordsError } = await supabase
      .from('win_loss_records')
      .select(`
        *,
        opportunity:opportunities(
          id, title, valor_previsto, temperature, prob,
          account:accounts(id, razao_social, nome_fantasia, segmento, porte, cnae),
          stage:stages(name),
          pipeline:pipelines(name)
        ),
        reason:loss_reasons(name)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (recordsError) throw recordsError;

    const wins = records?.filter(r => r.outcome === 'won') || [];
    const losses = records?.filter(r => r.outcome === 'lost') || [];

    console.log(`Analyzing ${wins.length} wins and ${losses.length} losses`);

    // Calculate metrics
    const wonValue = wins.reduce((sum, w) => sum + (w.final_value || (w.opportunity as any)?.valor_previsto || 0), 0);
    const lostValue = losses.reduce((sum, l) => sum + (l.final_value || (l.opportunity as any)?.valor_previsto || 0), 0);
    const totalDeals = wins.length + losses.length;
    const winRate = totalDeals > 0 ? Math.round(wins.length / totalDeals * 100) : 0;

    // Analyze loss reasons
    const lossReasonCounts: Record<string, { count: number; value: number }> = {};
    losses.forEach(l => {
      const reason = l.reason_seller || (l.reason as any)?.name || 'Não informado';
      if (!lossReasonCounts[reason]) {
        lossReasonCounts[reason] = { count: 0, value: 0 };
      }
      lossReasonCounts[reason].count++;
      lossReasonCounts[reason].value += l.final_value || (l.opportunity as any)?.valor_previsto || 0;
    });

    // Analyze competitors
    const competitorCounts: Record<string, { count: number; value: number }> = {};
    losses.filter(l => l.competitor).forEach(l => {
      if (!competitorCounts[l.competitor!]) {
        competitorCounts[l.competitor!] = { count: 0, value: 0 };
      }
      competitorCounts[l.competitor!].count++;
      competitorCounts[l.competitor!].value += l.final_value || (l.opportunity as any)?.valor_previsto || 0;
    });

    // Analyze decision factors
    const factors = {
      price: losses.filter(l => l.price_factor).length,
      timing: losses.filter(l => l.timing_factor).length,
      feature: losses.filter(l => l.feature_factor).length,
      relationship: losses.filter(l => l.relationship_factor).length
    };
    const totalFactors = Object.values(factors).reduce((a, b) => a + b, 0);

    // Analyze segments
    const segmentAnalysis: Record<string, { wins: number; losses: number; winRate: number }> = {};
    [...wins, ...losses].forEach(r => {
      const segment = (r.opportunity as any)?.account?.segmento || 'Não informado';
      if (!segmentAnalysis[segment]) {
        segmentAnalysis[segment] = { wins: 0, losses: 0, winRate: 0 };
      }
      if (r.outcome === 'won') segmentAnalysis[segment].wins++;
      else segmentAnalysis[segment].losses++;
    });
    Object.keys(segmentAnalysis).forEach(seg => {
      const s = segmentAnalysis[seg];
      s.winRate = s.wins + s.losses > 0 ? Math.round(s.wins / (s.wins + s.losses) * 100) : 0;
    });

    // Calculate sales cycle metrics
    const avgCycleWon = wins.length > 0
      ? Math.round(wins.reduce((sum, w) => sum + (w.sales_cycle_days || 0), 0) / wins.length)
      : 0;
    const avgCycleLost = losses.length > 0
      ? Math.round(losses.reduce((sum, l) => sum + (l.sales_cycle_days || 0), 0) / losses.length)
      : 0;

    // Generate AI insights using Lovable AI
    const insights: WinLossInsight[] = [];
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY && totalDeals >= 5) {
      const prompt = `Analise os dados de win/loss desta operação comercial e forneça insights estratégicos:

## Métricas Gerais
- Total de deals: ${totalDeals}
- Ganhos: ${wins.length} (${winRate}%)
- Perdidos: ${losses.length}
- Valor ganho: R$ ${wonValue.toLocaleString('pt-BR')}
- Valor perdido: R$ ${lostValue.toLocaleString('pt-BR')}

## Motivos de Perda (Top 5)
${Object.entries(lossReasonCounts)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5)
  .map(([reason, data]) => `- ${reason}: ${data.count} vezes (R$ ${data.value.toLocaleString('pt-BR')})`)
  .join('\n')}

## Concorrentes (Top 5)
${Object.entries(competitorCounts)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5)
  .map(([comp, data]) => `- ${comp}: ${data.count} vezes (R$ ${data.value.toLocaleString('pt-BR')})`)
  .join('\n')}

## Fatores de Decisão
- Preço: ${factors.price} (${totalFactors > 0 ? Math.round(factors.price / totalFactors * 100) : 0}%)
- Timing: ${factors.timing} (${totalFactors > 0 ? Math.round(factors.timing / totalFactors * 100) : 0}%)
- Features: ${factors.feature} (${totalFactors > 0 ? Math.round(factors.feature / totalFactors * 100) : 0}%)
- Relacionamento: ${factors.relationship} (${totalFactors > 0 ? Math.round(factors.relationship / totalFactors * 100) : 0}%)

## Ciclo de Venda
- Média ganhos: ${avgCycleWon} dias
- Média perdas: ${avgCycleLost} dias

## Win Rate por Segmento
${Object.entries(segmentAnalysis)
  .filter(([_, data]) => data.wins + data.losses >= 2)
  .sort((a, b) => b[1].winRate - a[1].winRate)
  .slice(0, 5)
  .map(([seg, data]) => `- ${seg}: ${data.winRate}% (${data.wins}/${data.wins + data.losses})`)
  .join('\n')}

Retorne EXATAMENTE neste formato JSON:
{
  "insights": [
    {
      "type": "<pattern|recommendation|alert>",
      "title": "<título curto do insight>",
      "description": "<descrição detalhada em 2-3 frases>",
      "impact": "<high|medium|low>",
      "metric": "<métrica relevante opcional>"
    }
  ],
  "summary": "<resumo executivo em 2-3 frases>",
  "action_items": [
    "<ação concreta 1>",
    "<ação concreta 2>",
    "<ação concreta 3>"
  ]
}

Gere 4-6 insights relevantes focando em padrões de perda, oportunidades de melhoria e recomendações estratégicas.`;

      try {
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
                content: 'Você é um analista de vendas experiente. Forneça insights acionáveis baseados em dados de win/loss.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: "json_object" }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const aiResponse = JSON.parse(data.choices[0].message.content);
          
          if (aiResponse.insights) {
            insights.push(...aiResponse.insights);
          }

          // Log AI usage
          await supabase.from('ai_usage_logs').insert({
            organization_id: organizationId,
            feature: 'gtm',
            action: 'analyze_winloss_batch',
            model_used: 'google/gemini-2.5-flash',
            tokens_input: data.usage?.prompt_tokens || 0,
            tokens_output: data.usage?.completion_tokens || 0,
            tokens_total: data.usage?.total_tokens || 0,
            success: true
          });

          // Store analysis result
          await supabase
            .from('ai_scores')
            .upsert({
              organization_id: organizationId,
              entity_type: 'organization',
              entity_id: organizationId,
              score_type: 'winloss_analysis',
              score: winRate,
              grade: winRate >= 50 ? 'healthy' : winRate >= 30 ? 'at_risk' : 'critical',
              factors: {
                lossReasons: lossReasonCounts,
                competitors: competitorCounts,
                decisionFactors: factors,
                segmentAnalysis
              },
              recommendations: aiResponse.action_items || [],
              status: 'active',
              created_at: new Date().toISOString()
            }, {
              onConflict: 'organization_id,entity_type,entity_id,score_type'
            });

          return new Response(JSON.stringify({
            success: true,
            metrics: {
              totalDeals,
              wins: wins.length,
              losses: losses.length,
              winRate,
              wonValue,
              lostValue,
              avgCycleWon,
              avgCycleLost
            },
            analysis: {
              lossReasons: Object.entries(lossReasonCounts)
                .map(([reason, data]) => ({ reason, ...data }))
                .sort((a, b) => b.count - a.count),
              competitors: Object.entries(competitorCounts)
                .map(([competitor, data]) => ({ competitor, ...data }))
                .sort((a, b) => b.count - a.count),
              factors,
              segmentAnalysis: Object.entries(segmentAnalysis)
                .map(([segment, data]) => ({ segment, ...data }))
                .sort((a, b) => b.winRate - a.winRate)
            },
            insights: aiResponse.insights || [],
            summary: aiResponse.summary || null,
            actionItems: aiResponse.action_items || []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
      }
    }

    // Fallback: return data without AI insights
    return new Response(JSON.stringify({
      success: true,
      metrics: {
        totalDeals,
        wins: wins.length,
        losses: losses.length,
        winRate,
        wonValue,
        lostValue,
        avgCycleWon,
        avgCycleLost
      },
      analysis: {
        lossReasons: Object.entries(lossReasonCounts)
          .map(([reason, data]) => ({ reason, ...data }))
          .sort((a, b) => b.count - a.count),
        competitors: Object.entries(competitorCounts)
          .map(([competitor, data]) => ({ competitor, ...data }))
          .sort((a, b) => b.count - a.count),
        factors,
        segmentAnalysis: Object.entries(segmentAnalysis)
          .map(([segment, data]) => ({ segment, ...data }))
          .sort((a, b) => b.winRate - a.winRate)
      },
      insights,
      summary: totalDeals < 5 ? 'Necessário mais dados para gerar insights (mínimo 5 deals)' : null,
      actionItems: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-winloss-batch:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
