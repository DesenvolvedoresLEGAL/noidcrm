import { supabase } from '@/integrations/supabase/client';

export async function getTodayTrainings(sellerId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .select('id', { count: 'exact', head: false })
    .eq('seller_id', sellerId)
    .gte('started_at', `${today}T00:00:00`)
    .lte('started_at', `${today}T23:59:59`)
    .not('finished_at', 'is', null)
    .gte('exchanges_count', 5);

  if (error) {
    console.error('Error fetching today trainings:', error);
    return 0;
  }

  return data?.length || 0;
}

export async function getOverallAverage(sellerId: string) {
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .select('score_overall')
    .eq('seller_id', sellerId)
    .not('finished_at', 'is', null)
    .not('score_overall', 'is', null)
    .gte('exchanges_count', 5);

  if (error) {
    console.error('Error fetching overall average:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const sum = data.reduce((acc, session) => acc + (session.score_overall || 0), 0);
  return sum / data.length;
}

export async function getCurrentStreak(sellerId: string) {
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .select('started_at')
    .eq('seller_id', sellerId)
    .not('finished_at', 'is', null)
    .gte('exchanges_count', 5)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching streak:', error);
    return 0;
  }

  if (!data || data.length === 0) {
    return 0;
  }

  // Get unique dates (in YYYY-MM-DD format)
  const uniqueDates = [...new Set(
    data.map(session => new Date(session.started_at).toISOString().split('T')[0])
  )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (uniqueDates.length === 0) {
    return 0;
  }

  // Check if there's a session today or yesterday
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return 0; // Streak is broken
  }

  // Count consecutive days
  let streak = 0;
  const todayTime = new Date(today).getTime();
  
  for (let i = 0; i < uniqueDates.length; i++) {
    const expectedDate = new Date(todayTime - (streak * 86400000)).toISOString().split('T')[0];
    
    if (uniqueDates[i] === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
