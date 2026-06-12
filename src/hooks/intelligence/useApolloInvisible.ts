import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  estimateApollo,
  getApolloKpis,
  getApolloRules,
  listApolloAudit,
  upsertApolloRules,
  type ApolloRules,
} from '@/services/intelligence/apolloInvisible';

export function useApolloRules() {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['apollo-rules', orgId],
    queryFn: () => getApolloRules(orgId!),
    enabled: !!orgId,
  });
  const mutation = useMutation({
    mutationFn: (patch: Partial<ApolloRules>) => upsertApolloRules(orgId!, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apollo-rules', orgId] }),
  });
  return { ...query, save: mutation.mutateAsync, saving: mutation.isPending };
}

export function useApolloEstimate(prospectIds?: string[], batchRunId?: string) {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['apollo-estimate', orgId, batchRunId, prospectIds?.length ?? 0],
    queryFn: () =>
      estimateApollo({ organization_id: orgId!, prospect_ids: prospectIds, batch_run_id: batchRunId }),
    enabled: !!orgId && ((prospectIds?.length ?? 0) > 0 || !!batchRunId),
    staleTime: 30_000,
  });
}

export function useApolloAudit(filters: { batchRunId?: string; status?: string } = {}) {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['apollo-audit', orgId, filters],
    queryFn: () => listApolloAudit(orgId!, filters),
    enabled: !!orgId,
  });
}

export function useApolloKpis(sinceDays = 30) {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();
  return useQuery({
    queryKey: ['apollo-kpis', orgId, sinceDays],
    queryFn: () => getApolloKpis(orgId!, { since }),
    enabled: !!orgId,
  });
}
