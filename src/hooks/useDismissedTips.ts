import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useDismissedTips() {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchDismissedTips = async () => {
      try {
        const { data, error } = await supabase
          .from('dismissed_tips')
          .select('tip_key')
          .eq('user_id', userId);

        if (error) throw error;

        setDismissedTips(new Set(data.map((d) => d.tip_key)));
      } catch (error) {
        console.error('[useDismissedTips] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDismissedTips();
  }, [userId]);

  const dismissTip = useCallback(async (tipKey: string) => {
    if (!userId) return;

    try {
      await supabase
        .from('dismissed_tips')
        .upsert(
          { user_id: userId, tip_key: tipKey },
          { onConflict: 'user_id,tip_key' }
        );

      setDismissedTips((prev) => new Set([...prev, tipKey]));
    } catch (error) {
      console.error('[useDismissedTips] Dismiss error:', error);
    }
  }, [userId]);

  const isTipDismissed = useCallback((tipKey: string) => {
    return dismissedTips.has(tipKey);
  }, [dismissedTips]);

  return { dismissedTips, loading, dismissTip, isTipDismissed };
}
