import { supabase } from '@/integrations/supabase/client';

export interface DailyBriefing {
  id: string;
  organization_id: string;
  user_id: string;
  briefing_date: string;
  briefing_type?: string;
  priority_actions: Array<{
    action: string;
    opportunity_id?: string | null;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  hot_opportunities: Array<{
    id: string;
    title: string;
    value: number;
    temperature?: string;
  }>;
  at_risk_deals: Array<{
    id: string;
    title: string;
    value: number;
    days_since_contact?: number;
  }>;
  coaching_insights?: Array<{
    seller: string;
    insight: string;
    action: string;
  }>;
  strategic_recommendations?: Array<{
    area: string;
    insight: string;
  }>;
  team_highlights?: Array<{
    name: string;
    xp?: number;
    level?: number;
  }>;
  summary: string;
  tasks_created: number;
  created_at: string;
}

export interface AISuggestion {
  id: string;
  organization_id: string;
  user_id: string;
  opportunity_id: string | null;
  suggestion_type: 'field_update' | 'stage_progression' | 'pipeline_cleanup';
  entity_type: string | null;
  entity_id: string | null;
  field_name: string | null;
  current_value: any;
  suggested_value: any;
  confidence_score: number;
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  action_taken_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function generateDailyBriefing(): Promise<DailyBriefing> {
  const { data, error } = await supabase.functions.invoke('daily-briefing-generator', {
    body: {}
  });

  if (error) throw error;
  return data as DailyBriefing;
}

export async function createAutoTasks(): Promise<{ success: boolean; tasks_created: number; tasks: any[] }> {
  const { data, error } = await supabase.functions.invoke('auto-task-creator', {
    body: {}
  });

  if (error) throw error;
  return data;
}

export async function generateFieldSuggestions(opportunityId: string): Promise<{ suggestions: AISuggestion[] }> {
  const { data, error } = await supabase.functions.invoke('ai-field-suggestions', {
    body: { opportunityId }
  });

  if (error) throw error;
  return data;
}

export async function generateCleanupSuggestions(): Promise<{ suggestions: AISuggestion[] }> {
  const { data, error } = await supabase.functions.invoke('pipeline-cleanup-suggester', {
    body: {}
  });

  if (error) throw error;
  return data;
}

export async function acceptSuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({
      status: 'accepted',
      action_taken_at: new Date().toISOString()
    })
    .eq('id', suggestionId);

  if (error) throw error;
}

export async function rejectSuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({
      status: 'rejected',
      action_taken_at: new Date().toISOString()
    })
    .eq('id', suggestionId);

  if (error) throw error;
}

export async function getPendingSuggestions(): Promise<AISuggestion[]> {
  const { data, error } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AISuggestion[];
}

export async function getTodayBriefing(): Promise<DailyBriefing | null> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('daily_briefings')
    .select('*')
    .eq('user_id', user.id)
    .eq('briefing_date', today)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data as unknown as DailyBriefing | null;
}
