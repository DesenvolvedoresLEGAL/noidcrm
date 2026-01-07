import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DealHealthAnalysis {
  opportunity_id: string;
  health_score: number;
  health_status: 'healthy' | 'at_risk' | 'critical';
  engagement_score: number;
  velocity_score: number;
  risk_score: number;
  factors: {
    positive: string[];
    negative: string[];
  };
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, userId, organizationId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let opportunities = [];

    if (opportunityId) {
      // Analyze single opportunity
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          account:accounts(id, razao_social, nome_fantasia, fit_score, intent_score),
          contact:contacts(id, nome, cargo),
          stage:stages(id, name, order_index),
          activities(id, type, status, scheduled_date, completed_at, created_at)
        `)
        .eq('id', opportunityId)
        .maybeSingle();
      
      if (error) throw error;
      if (data) opportunities = [data];
    } else if (organizationId) {
      // Analyze all open opportunities for organization
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          account:accounts(id, razao_social, nome_fantasia, fit_score, intent_score),
          contact:contacts(id, nome, cargo),
          stage:stages(id, name, order_index),
          activities(id, type, status, scheduled_date, completed_at, created_at)
        `)
        .eq('organization_id', organizationId)
        .not('status', 'in', '("won","lost")');
      
      if (error) throw error;
      opportunities = data || [];
    } else {
      throw new Error('Either opportunityId or organizationId is required');
    }

    console.log(`Analyzing health for ${opportunities.length} opportunities`);

    const analyses: DealHealthAnalysis[] = [];

    for (const opp of opportunities) {
      const now = new Date();
      const activities = opp.activities || [];
      
      // Calculate engagement score (0-100)
      let engagementScore = 50;
      const completedActivities = activities.filter((a: any) => a.status === 'completed');
      const recentActivities = completedActivities.filter((a: any) => {
        const completedAt = new Date(a.completed_at || a.created_at);
        const daysDiff = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 14;
      });
      
      if (recentActivities.length >= 3) engagementScore = 90;
      else if (recentActivities.length >= 2) engagementScore = 75;
      else if (recentActivities.length >= 1) engagementScore = 60;
      else if (completedActivities.length > 0) engagementScore = 40;
      else engagementScore = 20;

      // Calculate velocity score (0-100)
      let velocityScore = 50;
      const daysInStage = opp.days_in_stage || 0;
      const stageAlertDays = opp.stage?.stagnation_alert_days || 7;
      
      if (daysInStage <= stageAlertDays * 0.5) velocityScore = 90;
      else if (daysInStage <= stageAlertDays) velocityScore = 70;
      else if (daysInStage <= stageAlertDays * 1.5) velocityScore = 40;
      else velocityScore = 20;

      // Stage progression bonus
      const stageOrder = opp.stage?.order_index || 0;
      if (stageOrder >= 3) velocityScore = Math.min(100, velocityScore + 10);

      // Calculate risk score (0-100, higher = more risk)
      let riskScore = 30;
      const factors = { positive: [] as string[], negative: [] as string[] };
      
      // No scheduled activities
      const scheduledActivities = activities.filter((a: any) => a.status === 'scheduled' || a.status === 'pending');
      if (scheduledActivities.length === 0) {
        riskScore += 25;
        factors.negative.push('Sem atividades agendadas');
      } else {
        factors.positive.push(`${scheduledActivities.length} atividade(s) agendada(s)`);
      }

      // Long time in stage
      if (daysInStage > stageAlertDays * 2) {
        riskScore += 20;
        factors.negative.push(`${daysInStage} dias na mesma etapa`);
      } else if (daysInStage <= 3) {
        factors.positive.push('Avançando rapidamente');
      }

      // No contact in last 7 days
      const lastActivity = completedActivities.sort((a: any, b: any) => 
        new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime()
      )[0];
      
      if (lastActivity) {
        const lastContactDate = new Date(lastActivity.completed_at || lastActivity.created_at);
        const daysSinceContact = (now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceContact > 14) {
          riskScore += 20;
          factors.negative.push(`${Math.floor(daysSinceContact)} dias sem contato`);
        } else if (daysSinceContact <= 3) {
          factors.positive.push('Contato recente');
        }
      } else {
        riskScore += 15;
        factors.negative.push('Nenhum contato registrado');
      }

      // No decision maker contact
      const contactCargo = opp.contact?.cargo?.toLowerCase() || '';
      const isDecisionMaker = ['diretor', 'gerente', 'ceo', 'cfo', 'cto', 'owner', 'proprietário', 'sócio', 'presidente'].some(
        role => contactCargo.includes(role)
      );
      
      if (isDecisionMaker) {
        riskScore -= 10;
        factors.positive.push('Contato com decisor');
      }

      // Low value opportunity with high effort
      if ((opp.valor_previsto || 0) < 5000 && completedActivities.length > 10) {
        riskScore += 10;
        factors.negative.push('Alto esforço para valor baixo');
      }

      // High value opportunity
      if ((opp.valor_previsto || 0) > 50000) {
        factors.positive.push('Deal de alto valor');
      }

      // Account fit/intent scores
      if ((opp.account?.fit_score || 0) >= 70) {
        factors.positive.push('Conta com bom fit');
        riskScore -= 5;
      }
      if ((opp.account?.intent_score || 0) >= 70) {
        factors.positive.push('Alto sinal de intenção');
        riskScore -= 5;
      }

      // Temperature boost
      if (opp.temperature === 'hot' || opp.temperature === 'burning') {
        factors.positive.push('Lead quente');
      } else if (opp.temperature === 'cold') {
        riskScore += 10;
        factors.negative.push('Lead frio');
      }

      // Normalize risk score
      riskScore = Math.max(0, Math.min(100, riskScore));

      // Calculate overall health score (0-100, higher = healthier)
      const healthScore = Math.round(
        (engagementScore * 0.35) + 
        (velocityScore * 0.25) + 
        ((100 - riskScore) * 0.40)
      );

      // Determine health status
      let healthStatus: 'healthy' | 'at_risk' | 'critical';
      if (healthScore >= 65) healthStatus = 'healthy';
      else if (healthScore >= 40) healthStatus = 'at_risk';
      else healthStatus = 'critical';

      // Generate recommendations
      const recommendations: string[] = [];
      if (scheduledActivities.length === 0) {
        recommendations.push('Agende uma atividade para manter o deal em movimento');
      }
      if (daysInStage > stageAlertDays) {
        recommendations.push('Considere avançar ou qualificar melhor este deal');
      }
      if (!isDecisionMaker && opp.stage?.order_index >= 2) {
        recommendations.push('Busque contato com o decisor da conta');
      }
      if (riskScore >= 60) {
        recommendations.push('Priorize um contato imediato para reativar o interesse');
      }

      analyses.push({
        opportunity_id: opp.id,
        health_score: healthScore,
        health_status: healthStatus,
        engagement_score: Math.round(engagementScore),
        velocity_score: Math.round(velocityScore),
        risk_score: Math.round(riskScore),
        factors,
        recommendations
      });

      // Update opportunity scores
      await supabase
        .from('opportunities')
        .update({
          engagement_score: Math.round(engagementScore),
          velocity_score: Math.round(velocityScore),
          risk_score: Math.round(riskScore),
          opportunity_score: healthScore,
          score_updated_at: new Date().toISOString()
        })
        .eq('id', opp.id);

      // Store in ai_scores for history
      await supabase
        .from('ai_scores')
        .upsert({
          organization_id: opp.organization_id,
          entity_type: 'opportunity',
          entity_id: opp.id,
          score_type: 'deal_health',
          score: healthScore,
          grade: healthStatus,
          factors: factors,
          recommendations: recommendations,
          status: healthStatus,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,entity_type,entity_id,score_type'
        });
    }

    // Log AI usage
    if (organizationId || opportunities[0]?.organization_id) {
      await supabase.from('ai_usage_logs').insert({
        organization_id: organizationId || opportunities[0]?.organization_id,
        user_id: userId || null,
        feature: 'gtm',
        action: 'analyze_deal_health',
        model_used: 'algorithmic',
        tokens_total: 0,
        success: true
      });
    }

    console.log(`Completed health analysis for ${analyses.length} opportunities`);

    return new Response(JSON.stringify({ 
      success: true, 
      analyses,
      summary: {
        total: analyses.length,
        healthy: analyses.filter(a => a.health_status === 'healthy').length,
        at_risk: analyses.filter(a => a.health_status === 'at_risk').length,
        critical: analyses.filter(a => a.health_status === 'critical').length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-deal-health:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
