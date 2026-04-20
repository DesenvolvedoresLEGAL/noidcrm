import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WinLossInsight {
  type: 'pattern' | 'recommendation' | 'alert' | 'opportunity';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric?: string;
  category?: 'win' | 'loss' | 'general';
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

    // Fetch win/loss records with enriched data
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
        reason:loss_reasons(name),
        win_reason:win_reasons(name)
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

    // ========== LOSS ANALYSIS ==========
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

    // Analyze decision factors (losses)
    const lossFactors = {
      price: losses.filter(l => l.price_factor).length,
      timing: losses.filter(l => l.timing_factor).length,
      feature: losses.filter(l => l.feature_factor).length,
      relationship: losses.filter(l => l.relationship_factor).length
    };
    const totalLossFactors = Object.values(lossFactors).reduce((a, b) => a + b, 0);

    // Loss customer feedbacks
    const lossFeedbacks = losses
      .filter(l => l.customer_feedback && l.recorded_by_customer)
      .map(l => l.customer_feedback)
      .slice(0, 10);

    // ========== WIN ANALYSIS ==========
    const winReasonCounts: Record<string, { count: number; value: number }> = {};
    wins.forEach(w => {
      const reason = (w.win_reason as any)?.name || 'Não informado';
      if (!winReasonCounts[reason]) {
        winReasonCounts[reason] = { count: 0, value: 0 };
      }
      winReasonCounts[reason].count++;
      winReasonCounts[reason].value += w.final_value || (w.opportunity as any)?.valor_previsto || 0;
    });

    // Analyze key differentiators (wins)
    const differentiatorCounts: Record<string, number> = {};
    wins.forEach(w => {
      if (w.key_differentiator) {
        const diffs = w.key_differentiator.split(',').map((d: string) => d.trim());
        diffs.forEach((diff: string) => {
          if (diff) {
            differentiatorCounts[diff] = (differentiatorCounts[diff] || 0) + 1;
          }
        });
      }
    });

    // Win customer feedbacks
    const winFeedbacks = wins
      .filter(w => w.customer_feedback && w.recorded_by_customer)
      .map(w => w.customer_feedback)
      .slice(0, 10);

    // ========== SEGMENT ANALYSIS ==========
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
    
    if (LOVABLE_API_KEY && totalDeals >= 3) {
      const prompt = `Analise os dados completos de win/loss desta operação comercial e forneça insights estratégicos acionáveis:

## 📊 MÉTRICAS GERAIS
- Total de deals: ${totalDeals}
- Ganhos: ${wins.length} (${winRate}%)
- Perdidos: ${losses.length} (${100 - winRate}%)
- Valor ganho: R$ ${wonValue.toLocaleString('pt-BR')}
- Valor perdido: R$ ${lostValue.toLocaleString('pt-BR')}

## 🏆 ANÁLISE DE VITÓRIAS

### Motivos de Ganho (por que clientes nos escolheram)
${Object.entries(winReasonCounts)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5)
  .map(([reason, data]) => `- ${reason}: ${data.count} vezes (R$ ${data.value.toLocaleString('pt-BR')})`)
  .join('\n') || '- Nenhum dado registrado'}

### Diferenciais Decisivos (o que fechou os negócios)
${Object.entries(differentiatorCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([diff, count]) => `- ${diff}: ${count} vezes`)
  .join('\n') || '- Nenhum dado registrado'}

### Feedback dos Clientes (ao aprovar)
${winFeedbacks.slice(0, 5).map(f => `- "${f}"`).join('\n') || '- Nenhum feedback registrado'}

## ❌ ANÁLISE DE PERDAS

### Motivos de Perda
${Object.entries(lossReasonCounts)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5)
  .map(([reason, data]) => `- ${reason}: ${data.count} vezes (R$ ${data.value.toLocaleString('pt-BR')})`)
  .join('\n') || '- Nenhum dado registrado'}

### Concorrentes que Ganharam
${Object.entries(competitorCounts)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5)
  .map(([comp, data]) => `- ${comp}: ${data.count} vezes (R$ ${data.value.toLocaleString('pt-BR')})`)
  .join('\n') || '- Nenhum concorrente identificado'}

### Fatores de Decisão na Recusa
- Preço: ${lossFactors.price} (${totalLossFactors > 0 ? Math.round(lossFactors.price / totalLossFactors * 100) : 0}%)
- Timing: ${lossFactors.timing} (${totalLossFactors > 0 ? Math.round(lossFactors.timing / totalLossFactors * 100) : 0}%)
- Produto/Features: ${lossFactors.feature} (${totalLossFactors > 0 ? Math.round(lossFactors.feature / totalLossFactors * 100) : 0}%)
- Atendimento: ${lossFactors.relationship} (${totalLossFactors > 0 ? Math.round(lossFactors.relationship / totalLossFactors * 100) : 0}%)

### Feedback dos Clientes (ao recusar)
${lossFeedbacks.slice(0, 5).map(f => `- "${f}"`).join('\n') || '- Nenhum feedback registrado'}

## ⏱️ CICLO DE VENDA
- Média em ganhos: ${avgCycleWon} dias
- Média em perdas: ${avgCycleLost} dias
- Diferença: ${Math.abs(avgCycleWon - avgCycleLost)} dias ${avgCycleLost > avgCycleWon ? '(perdas demoram mais)' : '(ganhos demoram mais)'}

## 🎯 WIN RATE POR SEGMENTO
${Object.entries(segmentAnalysis)
  .filter(([_, data]) => data.wins + data.losses >= 2)
  .sort((a, b) => b[1].winRate - a[1].winRate)
  .slice(0, 5)
  .map(([seg, data]) => `- ${seg}: ${data.winRate}% (${data.wins}W/${data.losses}L)`)
  .join('\n') || '- Dados insuficientes'}

---

IMPORTANTE: Gere insights que comparem GANHOS vs PERDAS para identificar padrões de sucesso e oportunidades de melhoria.

Retorne EXATAMENTE neste formato JSON:
{
  "insights": [
    {
      "type": "<pattern|recommendation|alert|opportunity>",
      "title": "<título curto e impactante>",
      "description": "<descrição em 2-3 frases com dados específicos>",
      "impact": "<high|medium|low>",
      "metric": "<métrica relevante opcional>",
      "category": "<win|loss|general>"
    }
  ],
  "summary": "<resumo executivo em 2-3 frases destacando o insight mais importante>",
  "action_items": [
    "<ação concreta e específica 1>",
    "<ação concreta e específica 2>",
    "<ação concreta e específica 3>"
  ],
  "competitive_strategy": "<estratégia em 1-2 frases para vencer o principal concorrente>",
  "top_strength": "<principal ponto forte baseado nos dados de WIN>",
  "top_weakness": "<principal ponto fraco baseado nos dados de LOSS>"
}

Gere 5-7 insights relevantes focando em:
1. Padrões de vitória que devem ser replicados
2. Alertas sobre perdas evitáveis
3. Oportunidades de melhoria baseadas em feedback
4. Estratégias contra concorrentes específicos
5. Recomendações para aumentar win rate`;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
              {
                role: 'system',
                content: 'Você é um analista de vendas sênior especializado em Win/Loss Analysis. Forneça insights acionáveis e específicos baseados em dados reais. Seja direto e focado em impacto comercial.'
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
                winReasons: winReasonCounts,
                competitors: competitorCounts,
                decisionFactors: lossFactors,
                differentiators: differentiatorCounts,
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
              // Loss analysis
              lossReasons: Object.entries(lossReasonCounts)
                .map(([reason, data]) => ({ reason, ...data }))
                .sort((a, b) => b.count - a.count),
              competitors: Object.entries(competitorCounts)
                .map(([competitor, data]) => ({ competitor, ...data }))
                .sort((a, b) => b.count - a.count),
              lossFactors,
              lossFeedbacks,
              // Win analysis
              winReasons: Object.entries(winReasonCounts)
                .map(([reason, data]) => ({ reason, ...data }))
                .sort((a, b) => b.count - a.count),
              differentiators: Object.entries(differentiatorCounts)
                .map(([differentiator, count]) => ({ differentiator, count }))
                .sort((a, b) => b.count - a.count),
              winFeedbacks,
              // Segment analysis
              segmentAnalysis: Object.entries(segmentAnalysis)
                .map(([segment, data]) => ({ segment, ...data }))
                .sort((a, b) => b.winRate - a.winRate)
            },
            insights: aiResponse.insights || [],
            summary: aiResponse.summary || null,
            actionItems: aiResponse.action_items || [],
            competitiveStrategy: aiResponse.competitive_strategy || null,
            topStrength: aiResponse.top_strength || null,
            topWeakness: aiResponse.top_weakness || null
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
        lossFactors,
        lossFeedbacks,
        winReasons: Object.entries(winReasonCounts)
          .map(([reason, data]) => ({ reason, ...data }))
          .sort((a, b) => b.count - a.count),
        differentiators: Object.entries(differentiatorCounts)
          .map(([differentiator, count]) => ({ differentiator, count }))
          .sort((a, b) => b.count - a.count),
        winFeedbacks,
        segmentAnalysis: Object.entries(segmentAnalysis)
          .map(([segment, data]) => ({ segment, ...data }))
          .sort((a, b) => b.winRate - a.winRate)
      },
      insights,
      summary: totalDeals < 3 ? 'Necessário mais dados para gerar insights (mínimo 3 deals)' : null,
      actionItems: [],
      competitiveStrategy: null,
      topStrength: null,
      topWeakness: null
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
