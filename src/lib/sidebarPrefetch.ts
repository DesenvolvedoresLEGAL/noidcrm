// Prefetch helpers used by the sidebar's onMouseEnter on each route.
// We don't prefetch the route component (already lazy + cached after first
// load); instead we warm the React Query cache for the heaviest queries each
// page issues, so the page renders nearly instantly when navigated to.

import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Prefetch = (qc: QueryClient, organizationId: string | null | undefined) => void;

function isStale(qc: QueryClient, key: unknown[], maxAgeMs = 30_000) {
  const state = qc.getQueryState(key);
  if (!state) return true;
  if (state.fetchStatus === 'fetching') return false;
  return Date.now() - (state.dataUpdatedAt ?? 0) > maxAgeMs;
}

function prefetch<T>(qc: QueryClient, key: unknown[], fn: () => Promise<T>) {
  if (!isStale(qc, key)) return;
  void qc.prefetchQuery({ queryKey: key, queryFn: fn, staleTime: 30_000 });
}

const prefetchers: Record<string, Prefetch> = {
  '/app/opportunities': (qc, orgId) => {
    if (!orgId) return;
    prefetch(qc, ['opportunities-list', orgId], async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('id, title, stage_id, pipeline_id, status, valor_previsto, owner_user_id, account_id, close_date_prevista, prob, updated_at')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(200);
      return data ?? [];
    });
  },
  '/app/accounts': (qc, orgId) => {
    if (!orgId) return;
    prefetch(qc, ['accounts-list', orgId], async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, razao_social, nome_fantasia, cnpj, lifecycle_stage, owner_user_id, updated_at')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false })
        .limit(200);
      return data ?? [];
    });
  },
  '/app/activities': (qc, orgId) => {
    if (!orgId) return;
    prefetch(qc, ['activities-list', orgId], async () => {
      const { data } = await supabase
        .from('activities')
        .select('id, title, type, status, scheduled_date, owner_user_id, opportunity_id, account_id')
        .eq('organization_id', orgId)
        .order('scheduled_date', { ascending: false })
        .limit(200);
      return data ?? [];
    });
  },
};

export function prefetchRoute(qc: QueryClient, path: string, organizationId?: string | null) {
  const fn = prefetchers[path];
  if (fn) fn(qc, organizationId);
}
