import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/**
 * Sprint 2.1 — Reports V2 granular feature flag reader.
 *
 * Reads `organization_feature_flags.payload` for the `reports_v2_enabled` key.
 * Returns master switch + per-report sub-toggles.
 *
 * Usage:
 *   const { master, sub, loading } = useReportsV2Flag();
 *   if (master && sub.forecast) { ... show V2 forecast ... }
 */
export type ReportsV2SubFlags = {
  general: boolean;
  losses: boolean;
  forecast: boolean;
  closer: boolean;
  team: boolean;
  stage_metrics: boolean;
};

const DEFAULT_SUB: ReportsV2SubFlags = {
  general: false,
  losses: false,
  forecast: false,
  closer: false,
  team: false,
  stage_metrics: false,
};

export function useReportsV2Flag() {
  const { organization } = useCurrentUser();
  const [master, setMaster] = useState(false);
  const [sub, setSub] = useState<ReportsV2SubFlags>(DEFAULT_SUB);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organization?.id) {
        if (!cancelled) {
          setMaster(false);
          setSub(DEFAULT_SUB);
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase
          .from('organization_feature_flags')
          .select('enabled, payload')
          .eq('organization_id', organization.id)
          .eq('key', 'reports_v2_enabled')
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn('[useReportsV2Flag] error:', error.message);
          setMaster(false);
          setSub(DEFAULT_SUB);
        } else {
          setMaster(Boolean(data?.enabled));
          const payload = (data?.payload ?? {}) as Partial<ReportsV2SubFlags>;
          setSub({ ...DEFAULT_SUB, ...payload });
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useReportsV2Flag] threw:', err);
          setMaster(false);
          setSub(DEFAULT_SUB);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  return { master, sub, loading };
}
