// NRHS (NOID Revenue Hygiene Score) Calculator
// Complementa o Opportunity Score medindo confiabilidade/qualidade operacional

import { supabase } from '@/integrations/supabase/client';
import { NRHS_ISSUES } from './nrhs-issues';
import { checkDecisionMakerSync, isDecisionMakerCargo } from './decision-maker-checker';

export type NRHSTier = 'elite' | 'healthy' | 'risk' | 'critical' | 'insalubrious';

export interface NRHSPillarResult {
  score: number;
  issues: string[];
  passed: string[];
}

export interface NRHSBreakdown {
  pillars: {
    integrity: NRHSPillarResult;
    cadence: NRHSPillarResult;
    stakeholders: NRHSPillarResult;
    winloss: NRHSPillarResult;
    adherence: NRHSPillarResult;
  };
  issues_total: number;
  required_actions: {
    id: string;
    title: string;
    severity: 'high' | 'med' | 'low';
    cta: { type: string; target: string; label: string };
  }[];
}

export interface NRHSResult {
  score: number;
  tier: NRHSTier;
  breakdown: NRHSBreakdown;
  issues_count: number;
  blockers: string[];
}

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

// Get tier from score
export function getNRHSTier(score: number): NRHSTier {
  if (score >= 90) return 'elite';
  if (score >= 75) return 'healthy';
  if (score >= 60) return 'risk';
  if (score >= 40) return 'critical';
  return 'insalubrious';
}

// Get tier configuration
export function getNRHSTierConfig(tier: NRHSTier) {
  const configs: Record<NRHSTier, { label: string; color: string; bgColor: string; borderColor: string }> = {
    elite: { label: 'Elite', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', borderColor: 'border-emerald-500' },
    healthy: { label: 'Saudável', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', borderColor: 'border-blue-500' },
    risk: { label: 'Em Risco', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', borderColor: 'border-yellow-500' },
    critical: { label: 'Crítico', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', borderColor: 'border-orange-500' },
    insalubrious: { label: 'Insalubre', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', borderColor: 'border-red-500' }
  };
  return configs[tier];
}

// Calculate Integrity Pillar (30%)
function calculateIntegrityPillar(
  opportunity: any,
  now: Date
): NRHSPillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  // Value > 0 => +40
  if (opportunity.valor_previsto && opportunity.valor_previsto > 0) {
    score += 40;
    passed.push('value_present');
  } else {
    issues.push('missing_value');
  }

  // Close date present => +40
  if (opportunity.close_date_prevista) {
    score += 40;
    passed.push('close_date_present');
    
    // Close date not stale => +10
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

  // Value coherent with stage => +10 (if value exists)
  if (opportunity.valor_previsto && opportunity.valor_previsto > 0) {
    score += 10;
    passed.push('value_coherent');
  }

  return { score: Math.min(100, score), issues, passed };
}

// Calculate Cadence Pillar (25%)
function calculateCadencePillar(
  opportunity: any,
  activities: any[],
  stageName: string,
  now: Date
): NRHSPillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  // Find future activities
  const futureActivities = activities.filter(a => {
    if (!a.scheduled_date) return false;
    return new Date(a.scheduled_date) >= now && a.status !== 'completed';
  });

  // Has future activity => +50
  if (futureActivities.length > 0) {
    score += 50;
    passed.push('has_next_step');
    
    // Next activity within SLA => +30
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
    
    // Activity has purpose (description >= 20 chars) => +20
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

// Calculate Stakeholders Pillar (20%)
function calculateStakeholdersPillar(
  contacts: any[],
  dealParticipants: any[]
): NRHSPillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  // >= 2 contacts => +30
  if (contacts.length >= 2) {
    score += 30;
    passed.push('multiple_contacts');
  } else if (contacts.length === 1) {
    issues.push('single_contact');
    score += 15; // Partial credit
  }

  // Check for decisor using unified function
  const hasDecisor = checkDecisionMakerSync(contacts, dealParticipants);

  if (hasDecisor) {
    score += 50;
    passed.push('has_decisor');
  } else {
    issues.push('no_decisor');
  }

  // Check for champion
  const hasChampion = dealParticipants.some(p => p.role === 'champion') ||
    contacts.some(c => c.cargo?.toLowerCase().includes('champion'));

  if (hasChampion) {
    score += 20;
    passed.push('has_champion');
  } else {
    issues.push('no_champion');
  }

  return { score: Math.min(100, score), issues, passed };
}

// Calculate Win/Loss Pillar (15%)
function calculateWinLossPillar(
  opportunity: any
): NRHSPillarResult {
  const issues: string[] = [];
  const passed: string[] = [];

  // Only applies to lost opportunities
  if (opportunity.status !== 'lost') {
    return { score: 100, issues: [], passed: ['not_lost'] };
  }

  let score = 0;

  // Lost reason present => +40
  if (opportunity.lost_reason_id) {
    score += 40;
    passed.push('has_lost_reason');
    
    // Lost reason is not "Não informado" => +30
    // We check if there's a meaningful reason
    if (opportunity.lost_reason_detail && opportunity.lost_reason_detail.length > 0) {
      score += 30;
      passed.push('lost_reason_specific');
      
      // Lost reason detail >= 40 chars => +30
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

// Calculate Adherence Pillar (10%)
function calculateAdherencePillar(
  opportunity: any,
  weeklyReviews: any[],
  stageName: string,
  now: Date
): NRHSPillarResult {
  let score = 0;
  const issues: string[] = [];
  const passed: string[] = [];

  // Weekly review in last 7 days => +50
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

  // Stage coherent with status => +50
  // Simplified coherence check
  const status = opportunity.status;
  const stageNameLower = stageName?.toLowerCase() || '';
  
  let isCoherent = true;
  
  if (status === 'won' && !stageNameLower.includes('ganho') && !stageNameLower.includes('fechado')) {
    isCoherent = false;
  }
  if (status === 'lost' && !stageNameLower.includes('perdido') && !stageNameLower.includes('perdida')) {
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

// Main NRHS calculation function (client-side)
export async function calculateNRHSClient(opportunityId: string): Promise<NRHSResult | null> {
  try {
    // Fetch opportunity with related data
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        stage:stages(name)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError || !opportunity) {
      console.error('Error fetching opportunity:', oppError);
      return null;
    }

    const stageName = (opportunity.stage as any)?.name || '';

    // Fetch activities
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('scheduled_date', { ascending: true });

    // Fetch contacts via account
    const { data: contacts } = opportunity.account_id 
      ? await supabase
          .from('contacts')
          .select('*')
          .eq('account_id', opportunity.account_id)
      : { data: [] };

    // Fetch deal participants
    const { data: dealParticipants } = await supabase
      .from('deal_participants')
      .select('*')
      .eq('opportunity_id', opportunityId);

    // Fetch weekly reviews
    const { data: weeklyReviews } = await supabase
      .from('opportunities_weekly_review')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('reviewed_at', { ascending: false })
      .limit(5);

    const now = new Date();

    // Calculate each pillar
    const integrity = calculateIntegrityPillar(opportunity, now);
    const cadence = calculateCadencePillar(opportunity, activities || [], stageName, now);
    const stakeholders = calculateStakeholdersPillar(contacts || [], dealParticipants || []);
    const winloss = calculateWinLossPillar(opportunity);
    const adherence = calculateAdherencePillar(opportunity, weeklyReviews || [], stageName, now);

    // Calculate final score with weights
    const finalScore = Math.round(
      integrity.score * 0.30 +
      cadence.score * 0.25 +
      stakeholders.score * 0.20 +
      winloss.score * 0.15 +
      adherence.score * 0.10
    );

    const tier = getNRHSTier(finalScore);

    // Collect all issues
    const allIssues = [
      ...integrity.issues,
      ...cadence.issues,
      ...stakeholders.issues,
      ...winloss.issues,
      ...adherence.issues
    ];

    // Get blockers
    const blockers = allIssues.filter(id => NRHS_ISSUES[id]?.blocker);

    // Build required actions
    const requiredActions = allIssues
      .map(id => {
        const issue = NRHS_ISSUES[id];
        if (!issue) return null;
        return {
          id: issue.id,
          title: issue.title,
          severity: issue.severity,
          cta: issue.cta
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Blockers first
        const aBlocker = NRHS_ISSUES[a!.id]?.blocker ? 0 : 1;
        const bBlocker = NRHS_ISSUES[b!.id]?.blocker ? 0 : 1;
        if (aBlocker !== bBlocker) return aBlocker - bBlocker;
        
        // Then by severity
        const severityOrder: Record<string, number> = { high: 0, med: 1, low: 2 };
        return severityOrder[a!.severity] - severityOrder[b!.severity];
      }) as any[];

    const breakdown: NRHSBreakdown = {
      pillars: {
        integrity,
        cadence,
        stakeholders,
        winloss,
        adherence
      },
      issues_total: allIssues.length,
      required_actions: requiredActions
    };

    return {
      score: finalScore,
      tier,
      breakdown,
      issues_count: allIssues.length,
      blockers
    };
  } catch (error) {
    console.error('Error calculating NRHS:', error);
    return null;
  }
}

// Save NRHS result to database
export async function saveNRHSResult(
  opportunityId: string, 
  result: NRHSResult,
  organizationId: string,
  userId?: string
): Promise<boolean> {
  try {
    // Update opportunity
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        nrhs_score: result.score,
        nrhs_tier: result.tier,
        nrhs_breakdown: result.breakdown as any,
        nrhs_issues_count: result.issues_count,
        nrhs_blockers: result.blockers,
        nrhs_last_calculated_at: new Date().toISOString()
      })
      .eq('id', opportunityId);

    if (updateError) {
      console.error('Error updating NRHS:', updateError);
      return false;
    }

    // Log event
    await supabase.from('nrhs_events').insert({
      opportunity_id: opportunityId,
      user_id: userId || null,
      event_type: 'calculated',
      payload: { score: result.score, tier: result.tier, issues_count: result.issues_count },
      organization_id: organizationId
    });

    return true;
  } catch (error) {
    console.error('Error saving NRHS result:', error);
    return false;
  }
}

// Log weekly review
export async function logWeeklyReview(
  opportunityId: string,
  userId: string,
  organizationId: string,
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('opportunities_weekly_review')
      .insert({
        opportunity_id: opportunityId,
        user_id: userId,
        organization_id: organizationId,
        notes: notes || null,
        reviewed_at: new Date().toISOString()
      });

    return !error;
  } catch (error) {
    console.error('Error logging weekly review:', error);
    return false;
  }
}
