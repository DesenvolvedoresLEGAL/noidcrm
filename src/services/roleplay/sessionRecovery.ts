import { supabase } from '@/integrations/supabase/client';

export interface UnfinishedSession {
  id: string;
  started_at: string;
  exchanges_count: number | null;
  simulated_clients: {
    fake_name: string;
    fake_company: string;
  } | null;
  icp_profiles: {
    name: string;
  } | null;
}

/**
 * Check for unfinished roleplay sessions for a seller
 * Returns sessions that have started but not finished (no finished_at)
 * and have at least 1 message exchange
 */
export async function getUnfinishedSessions(sellerId: string): Promise<UnfinishedSession[]> {
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .select(`
      id,
      started_at,
      exchanges_count,
      simulated_clients(fake_name, fake_company),
      icp_profiles(name)
    `)
    .eq('seller_id', sellerId)
    .is('finished_at', null)
    .gt('exchanges_count', 0)
    .order('started_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[sessionRecovery] Error fetching unfinished sessions:', error);
    return [];
  }

  return data || [];
}

/**
 * Mark a session as abandoned (set finished_at but no score)
 */
export async function abandonSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('roleplay_sessions')
    .update({ 
      finished_at: new Date().toISOString(),
      // score_overall stays null to indicate abandoned
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[sessionRecovery] Error abandoning session:', error);
    throw error;
  }
}

/**
 * Save session progress to localStorage as backup
 */
export function saveSessionProgress(sessionId: string, messagesCount: number): void {
  try {
    const progress = {
      sessionId,
      messagesCount,
      lastActivity: new Date().toISOString(),
    };
    localStorage.setItem(`roleplay_progress_${sessionId}`, JSON.stringify(progress));
  } catch (e) {
    console.warn('[sessionRecovery] Could not save to localStorage:', e);
  }
}

/**
 * Get session progress from localStorage
 */
export function getSessionProgress(sessionId: string): { messagesCount: number; lastActivity: string } | null {
  try {
    const stored = localStorage.getItem(`roleplay_progress_${sessionId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[sessionRecovery] Could not read from localStorage:', e);
  }
  return null;
}

/**
 * Clear session progress from localStorage
 */
export function clearSessionProgress(sessionId: string): void {
  try {
    localStorage.removeItem(`roleplay_progress_${sessionId}`);
  } catch (e) {
    console.warn('[sessionRecovery] Could not clear from localStorage:', e);
  }
}
