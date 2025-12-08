import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChurnRiskFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, accountId } = await req.json();
    
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query for accounts
    let accountsQuery = supabase
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('lifecycle_stage', 'Cliente');
    
    if (accountId) {
      accountsQuery = accountsQuery.eq('id', accountId);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;
    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No client accounts found',
        predictions: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const predictions = [];
    const now = new Date();

    for (const account of accounts) {
      const riskFactors: ChurnRiskFactor[] = [];
      let churnProbability = 0;

      // Factor 1: NPS Score
      if (account.pontuacao_nps !== null) {
        if (account.pontuacao_nps <= 6) {
          riskFactors.push({
            factor: 'NPS Detrator',
            impact: 'high',
            description: `NPS de ${account.pontuacao_nps} indica insatisfação`
          });
          churnProbability += 25;
        } else if (account.pontuacao_nps <= 8) {
          riskFactors.push({
            factor: 'NPS Passivo',
            impact: 'medium',
            description: `NPS de ${account.pontuacao_nps} indica neutralidade`
          });
          churnProbability += 10;
        }
      } else {
        riskFactors.push({
          factor: 'Sem NPS',
          impact: 'medium',
          description: 'Cliente sem avaliação NPS recente'
        });
        churnProbability += 10;
      }

      // Factor 2: Activity recency - check last activities
      const { data: lastActivity } = await supabase
        .from('activities')
        .select('completed_at, scheduled_date')
        .eq('account_id', account.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastActivity?.completed_at) {
        const daysSinceContact = Math.floor(
          (now.getTime() - new Date(lastActivity.completed_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact > 60) {
          riskFactors.push({
            factor: 'Sem Contato Recente',
            impact: 'high',
            description: `${daysSinceContact} dias sem contato`
          });
          churnProbability += 20;
        } else if (daysSinceContact > 30) {
          riskFactors.push({
            factor: 'Contato Infrequente',
            impact: 'medium',
            description: `${daysSinceContact} dias desde último contato`
          });
          churnProbability += 10;
        }
      } else {
        riskFactors.push({
          factor: 'Sem Histórico de Atividades',
          impact: 'medium',
          description: 'Nenhuma atividade registrada'
        });
        churnProbability += 15;
      }

      // Factor 3: Contract renewal proximity
      const { data: activeContract } = await supabase
        .from('contracts')
        .select('end_date, status')
        .eq('account_id', account.id)
        .eq('status', 'active')
        .order('end_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (activeContract?.end_date) {
        const daysToRenewal = Math.floor(
          (new Date(activeContract.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysToRenewal <= 30 && daysToRenewal > 0) {
          riskFactors.push({
            factor: 'Renovação Próxima',
            impact: 'medium',
            description: `Contrato expira em ${daysToRenewal} dias`
          });
          churnProbability += 10;
        } else if (daysToRenewal <= 0) {
          riskFactors.push({
            factor: 'Contrato Expirado',
            impact: 'high',
            description: 'Contrato já expirou e não foi renovado'
          });
          churnProbability += 25;
        }
      }

      // Factor 4: Support tickets / negative sentiment
      const { data: recentConversations } = await supabase
        .from('conversation_logs')
        .select('sentiment, sentiment_score')
        .eq('account_id', account.id)
        .gte('created_at', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .limit(20);

      if (recentConversations && recentConversations.length > 0) {
        const negativeSentiments = recentConversations.filter(
          c => c.sentiment === 'negative' || (c.sentiment_score && c.sentiment_score < 0.3)
        );
        if (negativeSentiments.length >= 3) {
          riskFactors.push({
            factor: 'Sentimento Negativo',
            impact: 'high',
            description: `${negativeSentiments.length} interações negativas recentes`
          });
          churnProbability += 20;
        } else if (negativeSentiments.length > 0) {
          riskFactors.push({
            factor: 'Sinais de Insatisfação',
            impact: 'medium',
            description: `${negativeSentiments.length} interação(ões) negativa(s)`
          });
          churnProbability += 10;
        }
      }

      // Factor 5: Health metrics (CSAT, CES)
      const { data: healthMetrics } = await supabase
        .from('cs_health_metrics')
        .select('metric_type, score')
        .eq('account_id', account.id)
        .gte('survey_date', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('survey_date', { ascending: false });

      if (healthMetrics && healthMetrics.length > 0) {
        const csatScores = healthMetrics.filter(m => m.metric_type === 'csat');
        const cesScores = healthMetrics.filter(m => m.metric_type === 'ces');
        
        if (csatScores.length > 0) {
          const avgCsat = csatScores.reduce((sum, m) => sum + Number(m.score), 0) / csatScores.length;
          if (avgCsat < 3) {
            riskFactors.push({
              factor: 'CSAT Baixo',
              impact: 'high',
              description: `CSAT médio de ${avgCsat.toFixed(1)}/5`
            });
            churnProbability += 15;
          }
        }
        
        if (cesScores.length > 0) {
          const avgCes = cesScores.reduce((sum, m) => sum + Number(m.score), 0) / cesScores.length;
          if (avgCes > 4) {
            riskFactors.push({
              factor: 'CES Alto (Muito Esforço)',
              impact: 'medium',
              description: `CES médio de ${avgCes.toFixed(1)}/7 - cliente com dificuldades`
            });
            churnProbability += 10;
          }
        }
      }

      // Cap probability at 100
      churnProbability = Math.min(churnProbability, 100);

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (churnProbability >= 75) riskLevel = 'critical';
      else if (churnProbability >= 50) riskLevel = 'high';
      else if (churnProbability >= 25) riskLevel = 'medium';
      else riskLevel = 'low';

      // Generate AI recommendations
      const recommendations: string[] = [];
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

      if (LOVABLE_API_KEY && riskFactors.length > 0) {
        try {
          const prompt = `Baseado nos seguintes fatores de risco de churn para o cliente "${account.nome_fantasia || account.razao_social}":

${riskFactors.map(f => `- ${f.factor} (${f.impact}): ${f.description}`).join('\n')}

Probabilidade de churn calculada: ${churnProbability}%
Nível de risco: ${riskLevel}

Forneça 3-5 recomendações acionáveis e específicas para reduzir o risco de churn deste cliente.
Responda APENAS com um array JSON de strings, sem explicações adicionais:
["recomendação 1", "recomendação 2", "recomendação 3"]`;

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'Você é um especialista em Customer Success. Responda apenas com JSON válido.' },
                { role: 'user', content: prompt }
              ],
              response_format: { type: "json_object" }
            }),
          });

          if (response.ok) {
            const data = await response.json();
            try {
              const content = data.choices[0].message.content;
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                recommendations.push(...parsed);
              } else if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
                recommendations.push(...parsed.recommendations);
              }
            } catch {
              console.log('Failed to parse AI recommendations');
            }
          }
        } catch (aiError) {
          console.error('AI recommendation error:', aiError);
        }
      }

      // Default recommendations if AI fails
      if (recommendations.length === 0) {
        if (riskLevel === 'critical' || riskLevel === 'high') {
          recommendations.push('Agendar reunião de alinhamento com stakeholders');
          recommendations.push('Revisar contrato e condições comerciais');
          recommendations.push('Identificar quick wins para demonstrar valor');
        } else if (riskLevel === 'medium') {
          recommendations.push('Enviar pesquisa de satisfação');
          recommendations.push('Agendar check-in de relacionamento');
        }
      }

      // Save prediction to database
      const { data: savedPrediction, error: saveError } = await supabase
        .from('churn_predictions')
        .upsert({
          organization_id: organizationId,
          account_id: account.id,
          prediction_date: now.toISOString(),
          churn_probability: churnProbability,
          risk_level: riskLevel,
          risk_factors: riskFactors,
          recommendations,
          model_version: 'v1.0',
          confidence_score: Math.min(100, 50 + riskFactors.length * 10),
          expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'account_id'
        })
        .select()
        .maybeSingle();

      if (saveError) {
        console.error('Error saving prediction:', saveError);
      }

      predictions.push({
        accountId: account.id,
        accountName: account.nome_fantasia || account.razao_social,
        churnProbability,
        riskLevel,
        riskFactors,
        recommendations,
        savedAt: savedPrediction?.created_at
      });
    }

    // Log AI usage
    await supabase.from('ai_usage_logs').insert({
      organization_id: organizationId,
      feature: 'cs',
      action: 'predict_churn',
      model_used: 'google/gemini-2.5-flash',
      success: true
    });

    return new Response(JSON.stringify({
      success: true,
      predictions,
      summary: {
        total: predictions.length,
        critical: predictions.filter(p => p.riskLevel === 'critical').length,
        high: predictions.filter(p => p.riskLevel === 'high').length,
        medium: predictions.filter(p => p.riskLevel === 'medium').length,
        low: predictions.filter(p => p.riskLevel === 'low').length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in predict-churn:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
