import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { ReportTabMode, ReportTabModes } from '@/lib/reports/getReportTabMode';

/**
 * Sprint 2.1 — Reports V2 granular feature flag reader.
 * Sprint 2.9 — Estendido com `modes` opcional por aba (legacy_only/hybrid_rollout/v2_only).
 *
 * Lê `organization_feature_flags.payload` para a chave `reports_v2_enabled`.
 * Retorna master switch + sub-toggles boolean (retro-compat) + modes opcionais.
 *
 * Uso:
 *   const { master, sub, modes, loading } = useReportsV2Flag();
 *   const mode = getReportTabMode('forecast', master, sub, modes);
 */
export type ReportsV2SubFlags = {
  general: boolean;
  losses: boolean;
  forecast: boolean;
  closer: boolean;
  team: boolean;
  stage_metrics: boolean;
  // Sprint 2.8 — Fase 2 (telas analíticas/operacionais)
  origins: boolean;
  processed: boolean;
  sdr: boolean;
  handoff: boolean;
  stage_balance: boolean;
  stage_conversion: boolean;
  stages: boolean;
  accumulated: boolean;
};

const DEFAULT_SUB: ReportsV2SubFlags = {
  general: false,
  losses: false,
  forecast: false,
  closer: false,
  team: false,
  stage_metrics: false,
  origins: false,
  processed: false,
  sdr: false,
  handoff: false,
  stage_balance: false,
  stage_conversion: false,
  stages: false,
  accumulated: false,
};

interface PayloadShape extends Partial<ReportsV2SubFlags> {
  modes?: ReportTabModes;
}

export function useReportsV2Flag() {
  const { organization } = useCurrentUser();
  const [master, setMaster] = useState(false);
  const [sub, setSub] = useState<ReportsV2SubFlags>(DEFAULT_SUB);
  const [modes, setModes] = useState<ReportTabModes>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organization?.id) {
        if (!cancelled) {
          setMaster(false);
          setSub(DEFAULT_SUB);
          setModes({});
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
          setModes({});
        } else {
          setMaster(Boolean(data?.enabled));
          const payload = (data?.payload ?? {}) as PayloadShape;
          const { modes: payloadModes, ...subPayload } = payload;
          setSub({ ...DEFAULT_SUB, ...(subPayload as Partial<ReportsV2SubFlags>) });
          setModes((payloadModes ?? {}) as ReportTabModes);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useReportsV2Flag] threw:', err);
          setMaster(false);
          setSub(DEFAULT_SUB);
          setModes({});
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

  return { master, sub, modes, loading } as { master: boolean; sub: ReportsV2SubFlags; modes: ReportTabModes; loading: boolean };
}

// Re-export para conveniência.
export type { ReportTabMode, ReportTabModes };
