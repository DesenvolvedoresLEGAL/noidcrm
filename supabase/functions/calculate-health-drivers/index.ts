import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthDriver {
  driver_name: string;
  driver_category: 'engagement' | 'velocity' | 'relationship' | 'behavior';
  driver_source: 'graph' | 'memory' | 'behavior' | 'activity' | 'history';
  current_value: number;
  benchmark_value: number | null;
  impact_score: number;
  impact_direction: 'positive' | 'negative' | 'neutral';
  evidence_description: string;
  evidence_data: Record<string, any>;
  remediation_priority: 'critical' | 'high' | 'medium' | 'low' | null;
  suggested_playbook_id: string | null;
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

    // Fetch opportunity
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        accounts:account_id (razao_social, nome_fantasia),
        stages:stage_id (name, probability),
        pipelines:pipeline_id (name)
      `)
      .eq('id', opportunityId)
      .maybeSingle();

    if (oppError || !opportunity) {
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const drivers: HealthDriver[] = [];
    let healthScore = 100;

    // Delete existing drivers for this opportunity
    await supabase
      .from('health_score_drivers')
      .delete()
      .eq('opportunity_id', opportunityId);

    // Find relevant playbooks for remediation
    const { data: playbooks } = await supabase
      .from('ai_playbooks')
      .select('id, name, target_stage, target_temperature, category')
      .eq('organization_id', opportunity.organization_id)
      .eq('is_active', true);

    const findPlaybook = (category: string, stage?: string): string | null => {
      const match = playbooks?.find(p => 
        p.category === category || 
        (stage && p.target_stage === stage)
      );
      return match?.id || null;
    };

    // 1. ENGAGEMENT DRIVERS
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const activityCount = activities?.length || 0;
    const completedCount = activities?.filter(a => a.status === 'completed').length || 0;
    const benchmarkActivities = 5;

    if (activityCount < benchmarkActivities) {
      const impact = Math.min(30, (benchmarkActivities - activityCount) * 10);
      healthScore -= impact;
      drivers.push({
        driver_name: 'activity_frequency',
        driver_category: 'engagement',
        driver_source: 'activity',
        current_value: activityCount,
        benchmark_value: benchmarkActivities,
        impact_score: -impact,
        impact_direction: 'negative',
        evidence_description: `Apenas ${activityCount} atividades nos últimos 30 dias (benchmark: ${benchmarkActivities})`,
        evidence_data: { activityCount, benchmark: benchmarkActivities, period: '30d' },
        remediation_priority: activityCount === 0 ? 'critical' : 'high',
        suggested_playbook_id: findPlaybook('follow_up')
      });
    } else {
      const impact = Math.min(15, (activityCount - benchmarkActivities) * 3);
      healthScore += impact;
      drivers.push({
        driver_name: 'activity_frequency',
        driver_category: 'engagement',
        driver_source: 'activity',
        current_value: activityCount,
        benchmark_value: benchmarkActivities,
        impact_score: impact,
        impact_direction: 'positive',
        evidence_description: `${activityCount} atividades nos últimos 30 dias - engajamento alto`,
        evidence_data: { activityCount, benchmark: benchmarkActivities },
        remediation_priority: null,
        suggested_playbook_id: null
      });
    }

    // Days since last contact
    const daysSinceContact = opportunity.last_contact_date 
      ? Math.floor((Date.now() - new Date(opportunity.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceContact > 14) {
      const impact = Math.min(25, Math.floor(daysSinceContact / 7) * 5);
      healthScore -= impact;
      drivers.push({
        driver_name: 'contact_recency',
        driver_category: 'engagement',
        driver_source: 'activity',
        current_value: daysSinceContact,
        benchmark_value: 7,
        impact_score: -impact,
        impact_direction: 'negative',
        evidence_description: `${daysSinceContact} dias sem contato com o cliente`,
        evidence_data: { daysSinceContact, lastContact: opportunity.last_contact_date },
        remediation_priority: daysSinceContact > 30 ? 'critical' : 'high',
        suggested_playbook_id: findPlaybook('reengagement')
      });
    }

    // 2. VELOCITY DRIVERS
    const daysInStage = opportunity.days_in_stage || 0;
    const benchmarkDaysInStage = 10;

    if (daysInStage > benchmarkDaysInStage) {
      const impact = Math.min(20, Math.floor((daysInStage - benchmarkDaysInStage) / 5) * 5);
      healthScore -= impact;
      drivers.push({
        driver_name: 'stage_velocity',
        driver_category: 'velocity',
        driver_source: 'history',
        current_value: daysInStage,
        benchmark_value: benchmarkDaysInStage,
        impact_score: -impact,
        impact_direction: 'negative',
        evidence_description: `${daysInStage} dias no estágio "${opportunity.stages?.name}" (benchmark: ${benchmarkDaysInStage})`,
        evidence_data: { daysInStage, stageName: opportunity.stages?.name, benchmark: benchmarkDaysInStage },
        remediation_priority: daysInStage > 20 ? 'high' : 'medium',
        suggested_playbook_id: findPlaybook('acceleration', opportunity.stages?.name)
      });
    }

    // Days until close date
    if (opportunity.close_date_prevista) {
      const daysUntilClose = Math.floor(
        (new Date(opportunity.close_date_prevista).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilClose < 0) {
        healthScore -= 20;
        drivers.push({
          driver_name: 'overdue_close_date',
          driver_category: 'velocity',
          driver_source: 'history',
          current_value: Math.abs(daysUntilClose),
          benchmark_value: 0,
          impact_score: -20,
          impact_direction: 'negative',
          evidence_description: `Data de fechamento prevista passou há ${Math.abs(daysUntilClose)} dias`,
          evidence_data: { daysOverdue: Math.abs(daysUntilClose), closeDate: opportunity.close_date_prevista },
          remediation_priority: 'critical',
          suggested_playbook_id: findPlaybook('closing')
        });
      } else if (daysUntilClose < 7 && opportunity.stages?.probability < 80) {
        healthScore -= 10;
        drivers.push({
          driver_name: 'close_date_at_risk',
          driver_category: 'velocity',
          driver_source: 'history',
          current_value: daysUntilClose,
          benchmark_value: 14,
          impact_score: -10,
          impact_direction: 'negative',
          evidence_description: `Apenas ${daysUntilClose} dias até fechamento previsto com probabilidade de ${opportunity.stages?.probability}%`,
          evidence_data: { daysUntilClose, probability: opportunity.stages?.probability },
          remediation_priority: 'high',
          suggested_playbook_id: findPlaybook('closing')
        });
      }
    }

    // 3. RELATIONSHIP DRIVERS
    const { data: graphInsights } = await supabase
      .from('graph_insights')
      .select('*')
      .eq('entity_type', 'opportunity')
      .eq('entity_id', opportunityId)
      .eq('status', 'active');

    const hasChampion = !graphInsights?.some(i => i.insight_type === 'missing_champion');
    const hasDecisionMaker = !graphInsights?.some(i => i.insight_type === 'missing_decision_maker');

    if (!hasChampion) {
      healthScore -= 15;
      drivers.push({
        driver_name: 'missing_champion',
        driver_category: 'relationship',
        driver_source: 'graph',
        current_value: 0,
        benchmark_value: 1,
        impact_score: -15,
        impact_direction: 'negative',
        evidence_description: 'Nenhum champion identificado para defender a solução internamente',
        evidence_data: { hasChampion: false },
        remediation_priority: 'high',
        suggested_playbook_id: findPlaybook('champion_building')
      });
    } else {
      healthScore += 10;
      drivers.push({
        driver_name: 'champion_identified',
        driver_category: 'relationship',
        driver_source: 'graph',
        current_value: 1,
        benchmark_value: 1,
        impact_score: 10,
        impact_direction: 'positive',
        evidence_description: 'Champion identificado e ativo no processo',
        evidence_data: { hasChampion: true },
        remediation_priority: null,
        suggested_playbook_id: null
      });
    }

    if (!hasDecisionMaker && opportunity.valor_previsto > 10000) {
      healthScore -= 10;
      drivers.push({
        driver_name: 'missing_decision_maker',
        driver_category: 'relationship',
        driver_source: 'graph',
        current_value: 0,
        benchmark_value: 1,
        impact_score: -10,
        impact_direction: 'negative',
        evidence_description: 'Decisor não mapeado em deal de alto valor',
        evidence_data: { hasDecisionMaker: false, dealValue: opportunity.valor_previsto },
        remediation_priority: 'high',
        suggested_playbook_id: findPlaybook('stakeholder_mapping')
      });
    }

    // 4. BEHAVIOR DRIVERS
    const { data: proposals } = await supabase
      .from('proposals')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });

    const hasProposal = proposals && proposals.length > 0;
    const sentProposal = proposals?.find(p => p.status === 'sent');
    const viewedProposal = proposals?.find(p => p.views_count > 0);

    if (sentProposal && !viewedProposal) {
      const daysSinceSent = sentProposal.sent_at 
        ? Math.floor((Date.now() - new Date(sentProposal.sent_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (daysSinceSent > 3) {
        healthScore -= 15;
        drivers.push({
          driver_name: 'proposal_not_viewed',
          driver_category: 'behavior',
          driver_source: 'behavior',
          current_value: daysSinceSent,
          benchmark_value: 3,
          impact_score: -15,
          impact_direction: 'negative',
          evidence_description: `Proposta enviada há ${daysSinceSent} dias e não visualizada`,
          evidence_data: { daysSinceSent, proposalId: sentProposal.id },
          remediation_priority: 'high',
          suggested_playbook_id: findPlaybook('proposal_follow_up')
        });
      }
    } else if (viewedProposal) {
      healthScore += 10;
      drivers.push({
        driver_name: 'proposal_engaged',
        driver_category: 'behavior',
        driver_source: 'behavior',
        current_value: viewedProposal.views_count || 1,
        benchmark_value: 1,
        impact_score: 10,
        impact_direction: 'positive',
        evidence_description: `Proposta visualizada ${viewedProposal.views_count}x pelo cliente`,
        evidence_data: { viewsCount: viewedProposal.views_count, proposalId: viewedProposal.id },
        remediation_priority: null,
        suggested_playbook_id: null
      });
    }

    // Normalize health score
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Save drivers to database
    const driversToInsert = drivers.map(d => ({
      organization_id: opportunity.organization_id,
      opportunity_id: opportunityId,
      ...d
    }));

    if (driversToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('health_score_drivers')
        .insert(driversToInsert);

      if (insertError) {
        console.error('Error inserting health drivers:', insertError);
      }
    }

    // Update opportunity health score
    await supabase
      .from('opportunities')
      .update({ 
        opportunity_score: healthScore,
        score_updated_at: new Date().toISOString()
      })
      .eq('id', opportunityId);

    // Check if auto-remediation is needed
    const criticalDrivers = drivers.filter(d => d.remediation_priority === 'critical');
    
    return new Response(JSON.stringify({
      healthScore,
      drivers,
      criticalCount: criticalDrivers.length,
      needsRemediation: healthScore < 40 || criticalDrivers.length > 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-health-drivers:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
