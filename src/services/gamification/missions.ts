import { supabase } from '@/integrations/supabase/client';

export interface Mission {
  id: string;
  code: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly';
  category: 'roleplay' | 'crm' | 'engagement';
  target_type: string;
  target_value: number;
  xp_reward: number;
  icon: string;
  is_active: boolean;
}

export interface SellerMission {
  id: string;
  seller_id: string;
  mission_id: string;
  period_start: string;
  current_progress: number;
  completed: boolean;
  completed_at: string | null;
  claimed: boolean;
  claimed_at: string | null;
  mission?: Mission;
}

export async function getSellerMissions(sellerId: string): Promise<SellerMission[]> {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('seller_missions')
    .select(`
      *,
      mission:missions(*)
    `)
    .eq('seller_id', sellerId)
    .in('period_start', [today, weekStart])
    .order('period_start', { ascending: false });

  if (error) {
    console.error('Error fetching seller missions:', error);
    return [];
  }

  return (data || []).map(sm => ({
    ...sm,
    mission: sm.mission as Mission
  }));
}

export async function getDailyMissions(sellerId: string): Promise<SellerMission[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('seller_missions')
    .select(`
      *,
      mission:missions(*)
    `)
    .eq('seller_id', sellerId)
    .eq('period_start', today);

  if (error) {
    console.error('Error fetching daily missions:', error);
    return [];
  }

  return (data || []).map(sm => ({
    ...sm,
    mission: sm.mission as Mission
  }));
}

export async function getWeeklyMissions(sellerId: string): Promise<SellerMission[]> {
  const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('seller_missions')
    .select(`
      *,
      mission:missions(*)
    `)
    .eq('seller_id', sellerId)
    .eq('period_start', weekStart);

  if (error) {
    console.error('Error fetching weekly missions:', error);
    return [];
  }

  return (data || []).map(sm => ({
    ...sm,
    mission: sm.mission as Mission
  }));
}

export async function claimMission(sellerId: string, missionId: string): Promise<{ success: boolean; xpEarned?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('missions-engine', {
    body: { sellerId, action: 'claim', metadata: { missionId } }
  });

  if (error) {
    console.error('Error claiming mission:', error);
    return { success: false, error: error.message };
  }

  return data;
}

export async function trackMissionAction(
  sellerId: string, 
  action: 'login' | 'roleplay_complete' | 'roleplay_pass' | 'activity_create' | 'proposal_create' | 'proposal_send',
  metadata?: { score?: number; sessionId?: string }
): Promise<void> {
  try {
    await supabase.functions.invoke('missions-engine', {
      body: { sellerId, action, metadata }
    });
  } catch (error) {
    console.error('Error tracking mission action:', error);
  }
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function getTimeUntilReset(type: 'daily' | 'weekly'): { hours: number; minutes: number } {
  const now = new Date();
  let resetTime: Date;

  if (type === 'daily') {
    // Reset at midnight (local time)
    resetTime = new Date(now);
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);
  } else {
    // Reset on Monday at midnight
    const weekStart = getWeekStart(now);
    resetTime = new Date(weekStart);
    resetTime.setDate(resetTime.getDate() + 7);
    resetTime.setHours(0, 0, 0, 0);
  }

  const diff = resetTime.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes };
}
