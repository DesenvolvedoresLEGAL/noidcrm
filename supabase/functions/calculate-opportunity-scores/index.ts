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
    const { opportunityId, recalculateAll } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let opportunities: any[] = [];
    
    if (opportunityId) {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*, account:accounts(*), stage:stages(*)')
        .eq('id', opportunityId)
        .single();
      if (error) throw error;
      opportunities = [data];
    } else if (recalculateAll) {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*, account:accounts(*), stage:stages(*)')
        .in('status', ['new', 'open'])
        .limit(500);
      if (error) throw error;
      opportunities = data || [];
    } else {
      throw new Error('opportunityId or recalculateAll is required');
    }

    const results = [];

    for (const opp of opportunities) {
      // Calculate all scores
      const engagementScore = await calculateEngagementScore(supabase, opp);
      const velocityScore = await calculateVelocityScore(supabase, opp);
      const riskScore = await calculateRiskScore(supabase, opp);
      
      // Update opportunity with new scores
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          engagement_score: engagementScore.score,
          velocity_score: velocityScore.score,
          risk_score: riskScore.score,
          scoring_factors: {
            engagement: engagementScore.factors,
            velocity: velocityScore.factors,
            risk: riskScore.factors,
            calculated_at: new Date().toISOString()
          }
        })
        .eq('id', opp.id);

      if (updateError) {
        console.error('Error updating opportunity scores:', updateError);
        continue;
      }

      // Refetch to get computed opportunity_score
      const { data: updated } = await supabase
        .from('opportunities')
        .select('opportunity_score')
        .eq('id', opp.id)
        .single();

      results.push({
        opportunityId: opp.id,
        engagementScore: engagementScore.score,
        velocityScore: velocityScore.score,
        riskScore: riskScore.score,
        opportunityScore: updated?.opportunity_score || 0
      });
    }

    console.log(`Calculated scores for ${results.length} opportunities`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-opportunity-scores:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to calculate scores' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateEngagementScore(supabase: any, opportunity: any) {
  let score = 0;
  const factors: Record<string, number> = {};

  // Get activities count
  const { data: activities, count: activitiesCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact' })
    .eq('opportunity_id', opportunity.id);

  // Activities points (5 each, max 40)
  const completedActivities = activities?.filter((a: any) => a.status === 'completed').length || 0;
  factors.atividades_completadas = Math.min(40, completedActivities * 5);
  score += factors.atividades_completadas;

  // Get emails count
  const { count: emailsCount } = await supabase
    .from('opportunity_emails')
    .select('*', { count: 'exact' })
    .eq('opportunity_id', opportunity.id);

  // Emails points (3 each, max 15)
  factors.emails = Math.min(15, (emailsCount || 0) * 3);
  score += factors.emails;

  // Get proposals count
  const { data: proposals } = await supabase
    .from('proposals')
    .select('status')
    .eq('opportunity_id', opportunity.id);

  // Proposals points (10 each, max 20)
  const sentProposals = proposals?.filter((p: any) => ['sent', 'accepted'].includes(p.status)).length || 0;
  factors.propostas_enviadas = Math.min(20, sentProposals * 10);
  score += factors.propostas_enviadas;

  // Get files count
  const { count: filesCount } = await supabase
    .from('opportunity_files')
    .select('*', { count: 'exact' })
    .eq('opportunity_id', opportunity.id);

  // Files points (2 each, max 10)
  factors.arquivos = Math.min(10, (filesCount || 0) * 2);
  score += factors.arquivos;

  // Get deal participants
  const { count: participantsCount } = await supabase
    .from('deal_participants')
    .select('*', { count: 'exact' })
    .eq('opportunity_id', opportunity.id);

  // Participants points (5 each, max 15)
  factors.participantes = Math.min(15, (participantsCount || 0) * 5);
  score += factors.participantes;

  // Frequency bonus - check if there are activities in last 5 days
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact' })
    .eq('opportunity_id', opportunity.id)
    .gte('completed_at', fiveDaysAgo);

  if ((recentCount || 0) > 0) {
    factors.contato_recente_bonus = 10;
    score += 10;
  }

  return { score: Math.min(100, score), factors };
}

async function calculateVelocityScore(supabase: any, opportunity: any) {
  let score = 50; // Start at 50 (neutral)
  const factors: Record<string, number> = {};
  const now = new Date();

  // Get stage info
  const stage = opportunity.stage;
  const stagnationDays = stage?.stagnation_alert_days || 14;

  // Days in current stage
  const createdAt = new Date(opportunity.created_at);
  const daysInPipeline = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate stage velocity from audit log
  const { data: stageChanges } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_id', opportunity.id)
    .eq('action', 'stage_moved')
    .order('created_at', { ascending: false });

  // Stage progressions bonus (15 points each)
  const progressions = stageChanges?.length || 0;
  factors.progressoes_stage = Math.min(45, progressions * 15);
  score += factors.progressoes_stage;

  // Check for regressions (negative)
  // This would need more complex logic to detect actual regressions

  // Days since last stage change
  const lastStageChange = stageChanges?.[0]?.created_at;
  if (lastStageChange) {
    const daysSinceChange = Math.floor((now.getTime() - new Date(lastStageChange).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceChange > stagnationDays) {
      const penalty = Math.min(30, (daysSinceChange - stagnationDays) * 2);
      factors.estagnacao_penalidade = -penalty;
      score -= penalty;
    }
  }

  // Close date analysis
  if (opportunity.close_date_prevista) {
    const closeDate = new Date(opportunity.close_date_prevista);
    const daysToClose = Math.floor((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysToClose < 0) {
      // Overdue - penalty
      factors.close_date_atrasada = -15;
      score -= 15;
    } else if (daysToClose <= 7) {
      // Close soon - bonus
      factors.close_date_proxima = 15;
      score += 15;
    } else if (daysToClose <= 30) {
      factors.close_date_ok = 5;
      score += 5;
    }
  }

  // Compare with average pipeline velocity (simplified)
  // In a full implementation, this would compare against historical data
  if (daysInPipeline < 30 && progressions > 0) {
    factors.velocidade_acima_media = 10;
    score += 10;
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

async function calculateRiskScore(supabase: any, opportunity: any) {
  let score = 0; // Higher = more risk
  const factors: Record<string, number> = {};
  const now = new Date();

  // Days since last contact
  const daysSinceContact = opportunity.days_since_contact || 0;
  if (daysSinceContact > 14) {
    factors.sem_contato_14_dias = 20;
    score += 20;
  } else if (daysSinceContact > 7) {
    factors.sem_contato_7_dias = 10;
    score += 10;
  }

  // Check for rejected proposals
  const { data: proposals } = await supabase
    .from('proposals')
    .select('status')
    .eq('opportunity_id', opportunity.id);

  const rejectedProposals = proposals?.filter((p: any) => p.status === 'rejected').length || 0;
  if (rejectedProposals > 0) {
    factors.proposta_rejeitada = 30;
    score += 30;
  }

  // Check for no-show activities (meetings that weren't completed)
  const { data: noShowActivities } = await supabase
    .from('activities')
    .select('*')
    .eq('opportunity_id', opportunity.id)
    .eq('type', 'meeting')
    .eq('status', 'cancelled')
    .limit(5);

  if (noShowActivities && noShowActivities.length > 0) {
    factors.reunioes_canceladas = Math.min(30, noShowActivities.length * 15);
    score += factors.reunioes_canceladas;
  }

  // Check for competitor mentions in notes
  const { data: notes } = await supabase
    .from('opportunity_notes')
    .select('content')
    .eq('opportunity_id', opportunity.id);

  const competitorKeywords = ['concorrente', 'concorrência', 'competitor', 'cotação', 'outra proposta'];
  const hasCompetitorMention = notes?.some((n: any) => 
    competitorKeywords.some(k => n.content?.toLowerCase().includes(k))
  );
  if (hasCompetitorMention) {
    factors.concorrente_mencionado = 15;
    score += 15;
  }

  // Close date passed without closing
  if (opportunity.close_date_prevista) {
    const closeDate = new Date(opportunity.close_date_prevista);
    if (closeDate < now && !['won', 'lost'].includes(opportunity.status)) {
      factors.prazo_ultrapassado = 15;
      score += 15;
    }
  }

  // Multiple close date changes (from audit log)
  const { data: dateChanges } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_id', opportunity.id)
    .eq('field_name', 'close_date_prevista')
    .limit(10);

  if (dateChanges && dateChanges.length > 2) {
    factors.multiplos_adiamentos = Math.min(20, (dateChanges.length - 2) * 10);
    score += factors.multiplos_adiamentos;
  }

  // Low probability set by user
  if (opportunity.prob && opportunity.prob < 30) {
    factors.probabilidade_baixa = 10;
    score += 10;
  }

  return { score: Math.min(100, score), factors };
}
