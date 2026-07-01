import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';

export interface KairosKPI {
  prospectsToday: number | null;
  sdrReady: number | null;
  coverageAvg: number | null;
  apolloRoi: number | null;
  attributedRevenue: number | null;
  skillsToday: number | null;
}

async function safeCount(promise: Promise<{ count: number | null; error: unknown }>): Promise<number | null> {
  try {
    const { count, error } = await promise;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export function useKairosCommandKPIs() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ['kairos-command-kpis', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<KairosKPI> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();

      const [prospectsToday, sdrReady, skillsToday] = await Promise.all([
        safeCount(
          (supabase as any)
            .from('prospects')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('created_at', startIso),
        ),
        safeCount(
          (supabase as any)
            .from('kairos_qualified_queue')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('sdr_ready', true),
        ),
        safeCount(
          (supabase as any)
            .from('noid_skill_runs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('created_at', startIso),
        ),
      ]);

      // Coverage average (best-effort)
      let coverageAvg: number | null = null;
      try {
        const { data } = await (supabase as any)
          .from('kairos_qualified_queue')
          .select('coverage_score')
          .eq('organization_id', orgId)
          .not('coverage_score', 'is', null)
          .limit(200);
        if (Array.isArray(data) && data.length) {
          const scores = data.map((d: any) => Number(d.coverage_score)).filter((n: number) => !Number.isNaN(n));
          if (scores.length) coverageAvg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
      } catch { /* noop */ }

      return {
        prospectsToday,
        sdrReady,
        coverageAvg,
        apolloRoi: null,
        attributedRevenue: null,
        skillsToday,
      };
    },
  });
}
