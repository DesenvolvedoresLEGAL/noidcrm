import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useFirstVisit(pageKey: string) {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !pageKey) {
      setLoading(false);
      return;
    }

    const checkFirstVisit = async () => {
      try {
        const { data: visit, error } = await supabase
          .from('user_first_visits')
          .select('id')
          .eq('user_id', userId)
          .eq('page_key', pageKey)
          .maybeSingle();

        if (error) throw error;

        // First visit if no record exists
        setIsFirstVisit(!visit);
      } catch (error) {
        console.error('[useFirstVisit] Error:', error);
        setIsFirstVisit(false);
      } finally {
        setLoading(false);
      }
    };

    checkFirstVisit();
  }, [userId, pageKey]);

  const markAsVisited = useCallback(async () => {
    if (!userId || !pageKey) return;

    try {
      await supabase
        .from('user_first_visits')
        .upsert(
          { user_id: userId, page_key: pageKey },
          { onConflict: 'user_id,page_key' }
        );

      setIsFirstVisit(false);
    } catch (error) {
      console.error('[useFirstVisit] Mark error:', error);
    }
  }, [userId, pageKey]);

  return { isFirstVisit, loading, markAsVisited };
}
