import { supabase } from '@/integrations/supabase/client';

export interface AccountScores {
  fit_score: number;
  intent_score: number;
  lead_score: number;
  lead_grade: string;
  scoring_factors: {
    fit?: Record<string, number>;
    intent?: Record<string, number>;
    calculated_at?: string;
  };
  score_updated_at: string | null;
}

export interface OpportunityScores {
  engagement_score: number;
  velocity_score: number;
  risk_score: number;
  opportunity_score: number;
  win_probability_ai: number | null;
  score_confidence: string;
  scoring_factors: {
    engagement?: Record<string, number>;
    velocity?: Record<string, number>;
    risk?: Record<string, number>;
    calculated_at?: string;
  };
  score_updated_at: string | null;
}

export interface ScoreHistory {
  id: string;
  entity_type: string;
  entity_id: string;
  score_type: string;
  old_value: number | null;
  new_value: number;
  change_reason: string | null;
  factors: Record<string, any>;
  created_at: string;
}

export interface ScoringRule {
  id: string;
  name: string;
  description: string | null;
  score_type: string;
  entity_type: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string | null;
  points: number;
  is_active: boolean;
}

export interface ScoreAlert {
  id: string;
  entity_type: string;
  entity_id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

// Calculate scores for a single account
export async function calculateAccountScores(accountId: string) {
  const { data, error } = await supabase.functions.invoke('calculate-account-scores', {
    body: { accountId }
  });
  
  if (error) throw error;
  return data;
}

// Calculate scores for a single opportunity
export async function calculateOpportunityScores(opportunityId: string) {
  const { data, error } = await supabase.functions.invoke('calculate-opportunity-scores', {
    body: { opportunityId }
  });
  
  if (error) throw error;
  return data;
}

// Get AI win probability prediction
export async function getWinProbability(opportunityId: string) {
  const { data, error } = await supabase.functions.invoke('ml-win-probability', {
    body: { opportunityId }
  });
  
  if (error) throw error;
  return data;
}

// Recalculate all scores (batch operation)
export async function recalculateAllScores(entityType: 'account' | 'opportunity') {
  const functionName = entityType === 'account' 
    ? 'calculate-account-scores' 
    : 'calculate-opportunity-scores';
    
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { recalculateAll: true }
  });
  
  if (error) throw error;
  return data;
}

// Get score history for an entity
export async function getScoreHistory(
  entityType: string, 
  entityId: string,
  limit = 50
): Promise<ScoreHistory[]> {
  const { data, error } = await supabase
    .from('score_history')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  return (data || []) as ScoreHistory[];
}

// Get scoring rules
export async function getScoringRules(): Promise<ScoringRule[]> {
  const { data, error } = await supabase
    .from('scoring_rules')
    .select('*')
    .order('score_type', { ascending: true });
    
  if (error) throw error;
  return (data || []) as ScoringRule[];
}

// Create scoring rule
export async function createScoringRule(rule: Omit<ScoringRule, 'id'>): Promise<ScoringRule> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  
  const { data, error } = await supabase
    .from('scoring_rules')
    .insert({ ...rule, organization_id: orgId })
    .select()
    .single();
    
  if (error) throw error;
  return data as ScoringRule;
}

// Update scoring rule
export async function updateScoringRule(id: string, updates: Partial<ScoringRule>): Promise<ScoringRule> {
  const { data, error } = await supabase
    .from('scoring_rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data as ScoringRule;
}

// Delete scoring rule
export async function deleteScoringRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('scoring_rules')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// Get score alerts
export async function getScoreAlerts(unreadOnly = false): Promise<ScoreAlert[]> {
  let query = supabase
    .from('score_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (unreadOnly) {
    query = query.eq('is_read', false);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ScoreAlert[];
}

// Mark alert as read
export async function markAlertAsRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('score_alerts')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', alertId);
    
  if (error) throw error;
}

// Get leads by grade
export async function getLeadsByGrade(grade?: string) {
  let query = supabase
    .from('accounts')
    .select('id, razao_social, nome_fantasia, segmento, tamanho, lead_score, lead_grade, fit_score, intent_score, score_updated_at')
    .order('lead_score', { ascending: false });
    
  if (grade) {
    query = query.eq('lead_grade', grade);
  }
  
  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data;
}

// Get top opportunities by score
export async function getTopOpportunitiesByScore(limit = 10) {
  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      id, 
      title, 
      valor_previsto, 
      opportunity_score, 
      engagement_score, 
      velocity_score, 
      risk_score,
      win_probability_ai,
      score_confidence,
      account:accounts(razao_social, nome_fantasia)
    `)
    .in('status', ['new', 'open'])
    .order('opportunity_score', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  return data;
}

// Get scoring summary stats - using RPC to bypass 1000 row limit
export async function getScoringSummary() {
  // Use RPC function for accurate counts (bypasses 1000 row limit)
  const { data: summaryData, error: summaryError } = await supabase.rpc('get_scoring_summary');
  
  if (summaryError) {
    console.error('Error fetching scoring summary:', summaryError);
    // Fallback to old method if RPC fails
    return getScoringSummaryFallback();
  }
  
  // Parse the JSON result
  const summary = summaryData as Record<string, any> | null;
  
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  if (summary?.lead_grades) {
    Object.entries(summary.lead_grades as Record<string, number>).forEach(([grade, count]) => {
      if (grades.hasOwnProperty(grade)) {
        grades[grade as keyof typeof grades] = Number(count) || 0;
      }
    });
  }
  
  const oppScores = (summary?.opportunity_scores || {}) as Record<string, number>;
  
  // Count high risk from opportunity data
  const { data: riskData } = await supabase
    .from('opportunities')
    .select('id', { count: 'exact' })
    .in('status', ['new', 'open'])
    .gte('risk_score', 60);

  return {
    leadGrades: grades,
    opportunityScores: {
      high: Number(oppScores.high) || 0,
      medium: Number(oppScores.medium) || 0,
      low: Number(oppScores.low) || 0
    },
    highRiskCount: riskData?.length || 0,
    totalLeads: Number(summary?.total_accounts) || 0,
    totalOpportunities: Number(summary?.total_opportunities) || 0
  };
}

// Fallback method if RPC fails (limited to 1000 records)
async function getScoringSummaryFallback() {
  const { data: gradeDistribution } = await supabase
    .from('accounts')
    .select('lead_grade');
    
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  gradeDistribution?.forEach((a: any) => {
    if (a.lead_grade && grades.hasOwnProperty(a.lead_grade)) {
      grades[a.lead_grade as keyof typeof grades]++;
    }
  });

  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('opportunity_score, risk_score')
    .in('status', ['new', 'open']);
    
  const highScore = opportunities?.filter((o: any) => o.opportunity_score >= 70).length || 0;
  const mediumScore = opportunities?.filter((o: any) => o.opportunity_score >= 40 && o.opportunity_score < 70).length || 0;
  const lowScore = opportunities?.filter((o: any) => o.opportunity_score < 40).length || 0;
  const highRisk = opportunities?.filter((o: any) => o.risk_score >= 60).length || 0;

  return {
    leadGrades: grades,
    opportunityScores: {
      high: highScore,
      medium: mediumScore,
      low: lowScore
    },
    highRiskCount: highRisk,
    totalLeads: gradeDistribution?.length || 0,
    totalOpportunities: opportunities?.length || 0
  };
}

// Get grade color
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-green-500';
    case 'B': return 'bg-blue-500';
    case 'C': return 'bg-yellow-500';
    case 'D': return 'bg-orange-500';
    case 'F': return 'bg-red-500';
    default: return 'bg-muted';
  }
}

// Get score color
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  if (score >= 20) return 'text-orange-600';
  return 'text-red-600';
}

// Get risk level
export function getRiskLevel(riskScore: number): { label: string; color: string } {
  if (riskScore >= 70) return { label: 'Alto', color: 'bg-red-500' };
  if (riskScore >= 40) return { label: 'Médio', color: 'bg-yellow-500' };
  return { label: 'Baixo', color: 'bg-green-500' };
}
