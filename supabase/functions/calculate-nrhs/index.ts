// Edge Function: calculate-nrhs
// Calculates NRHS (NOID Revenue Hygiene Score) for an opportunity

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage SLA configuration (days)
const STAGE_SLA: Record<string, number> = {
  'OPP': 7,
  'Qualificação': 7,
  'Proposta na Mesa': 3,
  'Negociação': 2,
  'Pré-aprovação': 2,
  'Contrato': 2,
  'default': 5
};

type NRHSTier = 'elite' | 'healthy' | 'risk' | 'critical' | 'insalubrious';

interface PillarResult {
  score: number;
  issues: string[];
  passed: string[];
}

function getNRHSTier(score: number): NRHSTier {
  if (score >= 90) return 'elite';
  if (score >= 75) return 'healthy';
  if (score >= 60) return 'risk';
  if (score >= 40) return 'critical';
  return 'insalubrious';
}

function calculateIntegrityPillar(opportunity: any, now: Date): PillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  if (opportunity.valor_previsto && opportunity.valor_previsto > 0) {
    score += 40;
    passed.push('value_present');
  } else {
    issues.push('missing_value');
  }

  if (opportunity.close_date_prevista) {
    score += 40;
    passed.push('close_date_present');
    
    const closeDate = new Date(opportunity.close_date_prevista);
    const updatedAt = opportunity.updated_at ? new Date(opportunity.updated_at) : null;
    const daysSinceUpdate = updatedAt 
      ? Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    if (closeDate >= now || daysSinceUpdate <= 7) {
      score += 10;
      passed.push('close_date_fresh');
    } else {
      issues.push('stale_close_date');
    }
  } else {
    issues.push('missing_close_date');
  }

  if (opportunity.valor_previsto && opportunity.valor_previsto > 0) {
    score += 10;
    passed.push('value_coherent');
  }

  return { score: Math.min(100, score), issues, passed };
}

function calculateCadencePillar(opportunity: any, activities: any[], stageName: string, now: Date): PillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  const futureActivities = activities.filter(a => {
    if (!a.scheduled_date) return false;
    return new Date(a.scheduled_date) >= now && a.status !== 'completed';
  });

  if (futureActivities.length > 0) {
    score += 50;
    passed.push('has_next_step');
    
    const nextActivity = futureActivities.sort((a, b) => 
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    )[0];
    
    const sla = STAGE_SLA[stageName] || STAGE_SLA.default;
    const daysUntilNext = Math.floor(
      (new Date(nextActivity.scheduled_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilNext <= sla) {
      score += 30;
      passed.push('next_step_within_sla');
    } else {
      issues.push('next_step_overdue');
    }
    
    if (nextActivity.description && nextActivity.description.length >= 20) {
      score += 20;
      passed.push('next_step_has_purpose');
    } else {
      issues.push('next_step_no_purpose');
    }
  } else {
    issues.push('no_next_step');
  }

  return { score: Math.min(100, score), issues, passed };
}

function calculateStakeholdersPillar(contacts: any[], dealParticipants: any[]): PillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  if (contacts.length >= 2) {
    score += 30;
    passed.push('multiple_contacts');
  } else if (contacts.length === 1) {
    issues.push('single_contact');
    score += 15;
  }

  const hasDecisor = contacts.some(c => 
    c.cargo?.toLowerCase().includes('decisor') ||
    c.cargo?.toLowerCase().includes('diretor') ||
    c.cargo?.toLowerCase().includes('ceo') ||
    c.cargo?.toLowerCase().includes('owner') ||
    c.cargo?.toLowerCase().includes('sócio') ||
    c.cargo?.toLowerCase().includes('gerente')
  ) || dealParticipants.some(p => p.role === 'decision_maker');

  if (hasDecisor) {
    score += 50;
    passed.push('has_decisor');
  } else {
    issues.push('no_decisor');
  }

  const hasChampion = dealParticipants.some(p => p.role === 'champion');
  if (hasChampion) {
    score += 20;
    passed.push('has_champion');
  } else {
    issues.push('no_champion');
  }

  return { score: Math.min(100, score), issues, passed };
}

function calculateWinLossPillar(opportunity: any): PillarResult {
  const issues: string[] = [];
  const passed: string[] = [];

  if (opportunity.status !== 'lost') {
    return { score: 100, issues: [], passed: ['not_lost'] };
  }

  let score = 0;

  if (opportunity.lost_reason_id) {
    score += 40;
    passed.push('has_lost_reason');
    
    if (opportunity.lost_reason_detail && opportunity.lost_reason_detail.length > 0) {
      score += 30;
      passed.push('lost_reason_specific');
      
      if (opportunity.lost_reason_detail.length >= 40) {
        score += 30;
        passed.push('lost_reason_detailed');
      } else {
        issues.push('lost_reason_no_detail');
      }
    } else {
      issues.push('lost_reason_not_informed');
    }
  } else {
    issues.push('missing_lost_reason');
  }

  return { score: Math.min(100, score), issues, passed };
}

function calculateAdherencePillar(opportunity: any, weeklyReviews: any[], stageName: string, now: Date): PillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  const recentReview = weeklyReviews.find(r => {
    const reviewDate = new Date(r.reviewed_at);
    const daysSince = Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince <= 7;
  });

  if (recentReview) {
    score += 50;
    passed.push('has_weekly_review');
  } else {
    issues.push('no_weekly_review');
  }

  const status = opportunity.status;
  const stageNameLower = stageName?.toLowerCase() || '';
  let isCoherent = true;
  
  if (status === 'won' && !stageNameLower.includes('ganho') && !stageNameLower.includes('fechado')) {
    isCoherent = false;
  }
  if (status === 'lost' && !stageNameLower.includes('perdido')) {
    isCoherent = false;
  }

  if (isCoherent) {
    score += 50;
    passed.push('stage_coherent');
  } else {
    issues.push('stage_status_mismatch');
  }

  return { score: Math.min(100, score), issues, passed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { opportunityId, userId } = await req.json();

    if (!opportunityId) {
      return new Response(
        JSON.stringify({ error: 'opportunityId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calculating NRHS for opportunity:', opportunityId);

    // Fetch opportunity
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        pipeline_stages!stage_id(name),
        organization_id
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError || !opportunity) {
      console.error('Error fetching opportunity:', oppError);
      return new Response(
        JSON.stringify({ error: 'Opportunity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stageName = (opportunity.pipeline_stages as any)?.name || '';
    const organizationId = opportunity.organization_id;

    // Fetch related data in parallel
    const [activitiesRes, contactsRes, participantsRes, reviewsRes] = await Promise.all([
      supabase.from('activities').select('*').eq('opportunity_id', opportunityId),
      opportunity.account_id 
        ? supabase.from('contacts').select('*').eq('account_id', opportunity.account_id)
        : Promise.resolve({ data: [] }),
      supabase.from('deal_participants').select('*').eq('opportunity_id', opportunityId),
      supabase.from('opportunities_weekly_review').select('*').eq('opportunity_id', opportunityId).order('reviewed_at', { ascending: false }).limit(5)
    ]);

    const activities = activitiesRes.data || [];
    const contacts = contactsRes.data || [];
    const dealParticipants = participantsRes.data || [];
    const weeklyReviews = reviewsRes.data || [];

    const now = new Date();

    // Calculate pillars
    const integrity = calculateIntegrityPillar(opportunity, now);
    const cadence = calculateCadencePillar(opportunity, activities, stageName, now);
    const stakeholders = calculateStakeholdersPillar(contacts, dealParticipants);
    const winloss = calculateWinLossPillar(opportunity);
    const adherence = calculateAdherencePillar(opportunity, weeklyReviews, stageName, now);

    // Calculate final score
    const finalScore = Math.round(
      integrity.score * 0.30 +
      cadence.score * 0.25 +
      stakeholders.score * 0.20 +
      winloss.score * 0.15 +
      adherence.score * 0.10
    );

    const tier = getNRHSTier(finalScore);

    // Collect issues
    const allIssues = [
      ...integrity.issues,
      ...cadence.issues,
      ...stakeholders.issues,
      ...winloss.issues,
      ...adherence.issues
    ];

    // Get previous tier for change detection
    const previousTier = opportunity.nrhs_tier;

    // Build breakdown
    const breakdown = {
      pillars: { integrity, cadence, stakeholders, winloss, adherence },
      issues_total: allIssues.length,
      required_actions: allIssues.map(id => ({
        id,
        title: id.replace(/_/g, ' '),
        severity: ['missing_value', 'missing_close_date', 'no_next_step', 'no_decisor', 'missing_lost_reason', 'lost_reason_not_informed'].includes(id) ? 'high' : 'med'
      }))
    };

    const blockers = allIssues.filter(id => 
      ['missing_value', 'missing_close_date', 'no_next_step', 'no_decisor', 'missing_lost_reason', 'lost_reason_not_informed'].includes(id)
    );

    // Update opportunity
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        nrhs_score: finalScore,
        nrhs_tier: tier,
        nrhs_breakdown: breakdown,
        nrhs_issues_count: allIssues.length,
        nrhs_blockers: blockers,
        nrhs_last_calculated_at: new Date().toISOString()
      })
      .eq('id', opportunityId);

    if (updateError) {
      console.error('Error updating opportunity:', updateError);
    }

    // Log event
    await supabase.from('nrhs_events').insert({
      opportunity_id: opportunityId,
      user_id: userId || null,
      event_type: previousTier !== tier ? 'tier_changed' : 'calculated',
      payload: { 
        score: finalScore, 
        tier, 
        previous_tier: previousTier,
        issues_count: allIssues.length 
      },
      organization_id: organizationId
    });

    console.log('NRHS calculated:', { opportunityId, score: finalScore, tier, issues: allIssues.length });

    return new Response(
      JSON.stringify({
        success: true,
        score: finalScore,
        tier,
        breakdown,
        issues_count: allIssues.length,
        blockers
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in calculate-nrhs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
