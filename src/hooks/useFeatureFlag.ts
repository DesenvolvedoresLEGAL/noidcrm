import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/**
 * Sprint 2.1 — Canonical feature flag reader.
 *
 * Reads `feature_flags.enabled` for the current user's organization.
 * Falls back to `false` if the flag does not exist or RPC fails.
 *
 * Usage:
 *   const { enabled, loading } = useFeatureFlag('reports_v2_enabled');
 */
export function useFeatureFlag(flagKey: string) {
  const { organization } = useCurrentUser();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!organization?.id) {
        if (!cancelled) {
          setEnabled(false);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_feature_enabled', {
          _flag_key: flagKey,
        });
        if (!cancelled) {
          if (error) {
            console.warn(`[useFeatureFlag] ${flagKey} fallback to false:`, error.message);
            setEnabled(false);
          } else {
            setEnabled(Boolean(data));
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(`[useFeatureFlag] ${flagKey} threw:`, err);
          setEnabled(false);
          setLoading(false);
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [flagKey, organization?.id]);

  return { enabled, loading };
}
