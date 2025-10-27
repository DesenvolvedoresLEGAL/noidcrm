import { supabase } from '@/integrations/supabase/client';

export interface TrainingWindow {
  start: string;
  end: string;
  timezone: string;
}

export interface PerformanceGate {
  min_score: number;
  window_sessions: number;
  active: boolean;
}

export interface RankingSettings {
  show_public: boolean;
  show_top_only: boolean;
  top_count: number;
  update_period_days: number;
}

export async function getTrainingWindow(orgId: string): Promise<TrainingWindow> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('section', 'roleplay')
    .eq('key', 'training_window')
    .eq('organization_id', orgId)
    .maybeSingle();
    
  return (data?.value as unknown as TrainingWindow) || { start: '08:30', end: '09:00', timezone: 'America/Sao_Paulo' };
}

export async function updateTrainingWindow(orgId: string, window: TrainingWindow) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      section: 'roleplay',
      key: 'training_window',
      value: window as any,
      organization_id: orgId,
    });

  if (error) throw error;
}

export async function getPerformanceGate(orgId: string): Promise<PerformanceGate> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('section', 'roleplay')
    .eq('key', 'performance_gate')
    .eq('organization_id', orgId)
    .maybeSingle();
    
  return (data?.value as unknown as PerformanceGate) || { min_score: 8.0, window_sessions: 5, active: true };
}

export async function updatePerformanceGate(orgId: string, gate: PerformanceGate) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      section: 'roleplay',
      key: 'performance_gate',
      value: gate as any,
      organization_id: orgId,
    });

  if (error) throw error;
}

export async function getRankingSettings(orgId: string): Promise<RankingSettings> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('section', 'roleplay')
    .eq('key', 'ranking_settings')
    .eq('organization_id', orgId)
    .maybeSingle();
    
  return (data?.value as unknown as RankingSettings) || { show_public: true, show_top_only: false, top_count: 10, update_period_days: 7 };
}

export async function updateRankingSettings(orgId: string, settings: RankingSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      section: 'roleplay',
      key: 'ranking_settings',
      value: settings as any,
      organization_id: orgId,
    });

  if (error) throw error;
}
