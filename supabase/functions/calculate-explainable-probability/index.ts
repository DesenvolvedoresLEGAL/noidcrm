import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvidenceFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  source: 'graph' | 'memory' | 'behavior' | 'history';
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId } = await req.json();
    
    if (!opportunityId) {
      return new Response(JSON.stringify({ error: 'opportunityId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch opportunity with related data
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        accounts:account_id (razao_social, nome_fantasia, fit_score, intent_score, lead_grade, segmento, porte),
        stages:stage_id (name, probability, order_index),
        pipelines:pipeline_id (name, pipeline_type)
      `)
      .eq('id', opportunityId)
      .maybeSingle();

    if (oppError || !opportunity) {
      console.error('Error fetching opportunity:', oppError);
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evidenceFactors: EvidenceFactor[] = [];
    let baseScore = opportunity.stages?.probability || 50;

    // 1. GRAPH-BASED FACTORS - Knowledge Graph insights
    const { data: graphInsights } = await supabase
      .from('graph_insights')
      .select('*')
      .eq('entity_type', 'opportunity')
      .eq('entity_id', opportunityId)
      .eq('status', 'active');

    if (graphInsights?.length) {
      for (const insight of graphInsights) {
        if (insight.insight_type === 'missing_champion') {
          evidenceFactors.push({
            factor: 'missing_champion',
            impact: 'negative',
            weight: -15,
            source: 'graph',
            description: 'Nenhum champion identificado na conta'
          });
          baseScore -= 15;
        } else if (insight.insight_type === 'strong_relationship') {
          evidenceFactors.push({
            factor: 'strong_relationship',
            impact: 'positive',
            weight: 10,
            source: 'graph',
            description: 'Relacionamento forte com decisor identificado'
          });
          baseScore += 10;
        } else if (insight.insight_type === 'weak_relationship') {
          evidenceFactors.push({
            factor: 'weak_engagement',
            impact: 'negative',
            weight: -10,
            source: 'graph',
            description: 'Pouco engajamento dos stakeholders'
          });
          baseScore -= 10;
        }
      }
    }

    // Count stakeholders from graph
    const { count: stakeholderCount } = await supabase
      .from('graph_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', opportunity.organization_id)
      .eq('entity_type', 'contact')
      .contains('metadata', { opportunity_id: opportunityId });

    if (stakeholderCount && stakeholderCount >= 3) {
      evidenceFactors.push({
        factor: 'multi_stakeholder',
        impact: 'positive',
        weight: 8,
        source: 'graph',
        description: `${stakeholderCount} stakeholders envolvidos no deal`
      });
      baseScore += 8;
    } else if (!stakeholderCount || stakeholderCount < 2) {
      evidenceFactors.push({
        factor: 'single_thread',
        impact: 'negative',
        weight: -10,
        source: 'graph',
        description: 'Deal depende de apenas 1 contato'
      });
      baseScore -= 10;
    }

    // 2. MEMORY-BASED FACTORS - Organizational learning
    const { data: memories } = await supabase
      .from('memories')
      .select('*')
      .eq('organization_id', opportunity.organization_id)
      .in('memory_type', ['win_pattern', 'loss_pattern', 'objection'])
      .limit(20);

    const accountSegment = opportunity.accounts?.segmento;
    const accountSize = opportunity.accounts?.porte;

    // Check for relevant win/loss patterns
    const winPatterns = memories?.filter(m => m.memory_type === 'win_pattern') || [];
    const lossPatterns = memories?.filter(m => m.memory_type === 'loss_pattern') || [];

    for (const pattern of winPatterns) {
      const patternMeta = pattern.context_metadata || {};
      if (patternMeta.segment === accountSegment || patternMeta.size === accountSize) {
        evidenceFactors.push({
          factor: 'win_pattern_match',
          impact: 'positive',
          weight: 12,
          source: 'memory',
          description: `Padrão de vitória identificado: ${pattern.title || 'Perfil similar'}`
        });
        baseScore += 12;
        break;
      }
    }

    for (const pattern of lossPatterns) {
      const patternMeta = pattern.context_metadata || {};
      if (patternMeta.segment === accountSegment) {
        evidenceFactors.push({
          factor: 'loss_pattern_warning',
          impact: 'negative',
          weight: -8,
          source: 'memory',
          description: `Alerta: Padrão de perda em segmento similar`
        });
        baseScore -= 8;
        break;
      }
    }

    // 3. BEHAVIOR-BASED FACTORS - Activities and engagement
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentActivities, error: actError } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const activityCount = recentActivities?.length || 0;
    const completedActivities = recentActivities?.filter(a => a.status === 'completed').length || 0;

    if (activityCount >= 5) {
      evidenceFactors.push({
        factor: 'high_activity',
        impact: 'positive',
        weight: 10,
        source: 'behavior',
        description: `${activityCount} atividades nos últimos 30 dias`
      });
      baseScore += 10;
    } else if (activityCount === 0) {
      evidenceFactors.push({
        factor: 'no_recent_activity',
        impact: 'negative',
        weight: -20,
        source: 'behavior',
        description: 'Nenhuma atividade nos últimos 30 dias'
      });
      baseScore -= 20;
    }

    // Proposal engagement
    const { data: proposals } = await supabase
      .from('proposals')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(5);

    const viewedProposals = proposals?.filter(p => p.views_count > 0) || [];
    if (viewedProposals.length > 0) {
      const totalViews = viewedProposals.reduce((sum, p) => sum + (p.views_count || 0), 0);
      evidenceFactors.push({
        factor: 'proposal_engagement',
        impact: 'positive',
        weight: 15,
        source: 'behavior',
        description: `Proposta visualizada ${totalViews}x pelo cliente`
      });
      baseScore += 15;
    } else if (proposals?.length && proposals.some(p => p.status === 'sent')) {
      evidenceFactors.push({
        factor: 'proposal_not_viewed',
        impact: 'negative',
        weight: -8,
        source: 'behavior',
        description: 'Proposta enviada mas não visualizada'
      });
      baseScore -= 8;
    }

    // 4. HISTORY-BASED FACTORS - Similar deals
    const { data: historicalDeals } = await supabase
      .from('opportunities')
      .select('id, status, valor_previsto')
      .eq('organization_id', opportunity.organization_id)
      .eq('pipeline_id', opportunity.pipeline_id)
      .neq('id', opportunityId)
      .in('status', ['won', 'lost'])
      .limit(50);

    if (historicalDeals?.length) {
      const wonDeals = historicalDeals.filter(d => d.status === 'won');
      const historicalWinRate = (wonDeals.length / historicalDeals.length) * 100;
      
      // Compare deal value with historical average
      const avgWonValue = wonDeals.length > 0 
        ? wonDeals.reduce((sum, d) => sum + (d.valor_previsto || 0), 0) / wonDeals.length 
        : 0;

      if (avgWonValue > 0 && opportunity.valor_previsto) {
        if (opportunity.valor_previsto > avgWonValue * 1.5) {
          evidenceFactors.push({
            factor: 'above_avg_value',
            impact: 'negative',
            weight: -5,
            source: 'history',
            description: `Valor 50% acima do ticket médio de R$${Math.round(avgWonValue / 1000)}k`
          });
          baseScore -= 5;
        } else if (opportunity.valor_previsto < avgWonValue * 0.5) {
          evidenceFactors.push({
            factor: 'below_avg_value',
            impact: 'positive',
            weight: 5,
            source: 'history',
            description: `Valor abaixo do ticket médio - menor risco`
          });
          baseScore += 5;
        }
      }

      // Stage velocity comparison
      if (opportunity.days_in_stage > 14) {
        evidenceFactors.push({
          factor: 'slow_progression',
          impact: 'negative',
          weight: -10,
          source: 'history',
          description: `${opportunity.days_in_stage} dias no estágio atual (acima da média)`
        });
        baseScore -= 10;
      }
    }

    // Account fit score
    if (opportunity.accounts?.fit_score) {
      const fitScore = opportunity.accounts.fit_score;
      if (fitScore >= 80) {
        evidenceFactors.push({
          factor: 'high_fit',
          impact: 'positive',
          weight: 10,
          source: 'behavior',
          description: `Fit Score alto: ${fitScore}/100`
        });
        baseScore += 10;
      } else if (fitScore < 40) {
        evidenceFactors.push({
          factor: 'low_fit',
          impact: 'negative',
          weight: -10,
          source: 'behavior',
          description: `Fit Score baixo: ${fitScore}/100`
        });
        baseScore -= 10;
      }
    }

    // Normalize score to 0-100
    const finalProbability = Math.max(0, Math.min(100, baseScore));
    
    // Calculate confidence based on evidence count
    const confidenceLevel = Math.min(0.95, 0.5 + (evidenceFactors.length * 0.05));

    // Calculate confidence interval
    const intervalWidth = 20 * (1 - confidenceLevel);
    const confidenceIntervalLow = Math.max(0, finalProbability - intervalWidth);
    const confidenceIntervalHigh = Math.min(100, finalProbability + intervalWidth);

    // Save prediction
    const { data: prediction, error: saveError } = await supabase
      .from('forecast_predictions')
      .insert({
        organization_id: opportunity.organization_id,
        opportunity_id: opportunityId,
        prediction_type: 'win_probability',
        prediction_source: 'ai_model',
        model_version: 'explainable_v1',
        predicted_value: finalProbability,
        confidence_level: confidenceLevel,
        confidence_interval_low: confidenceIntervalLow,
        confidence_interval_high: confidenceIntervalHigh,
        evidence_factors: evidenceFactors,
        pipeline_id: opportunity.pipeline_id,
        stage_id: opportunity.stage_id
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving prediction:', saveError);
    }

    // Update opportunity with new probability
    await supabase
      .from('opportunities')
      .update({ 
        win_probability_ai: finalProbability,
        score_confidence: confidenceLevel < 0.6 ? 'low' : confidenceLevel < 0.8 ? 'medium' : 'high'
      })
      .eq('id', opportunityId);

    return new Response(JSON.stringify({
      probability: finalProbability,
      confidence: confidenceLevel,
      confidenceInterval: {
        low: confidenceIntervalLow,
        high: confidenceIntervalHigh
      },
      evidenceFactors,
      predictionId: prediction?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-explainable-probability:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
