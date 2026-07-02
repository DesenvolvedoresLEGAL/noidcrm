import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  listApolloQueryLogs,
  replayApolloQuery,
  runApolloRaw,
  type ApolloQueryLog,
} from '@/services/intelligence/apolloInvisible';

export function useApolloQueryLogs(prospect_id?: string, limit = 25) {
  const { organization } = useCurrentUser();
  return useQuery<ApolloQueryLog[]>({
    queryKey: ['apollo-query-logs', organization?.id, prospect_id, limit],
    enabled: !!organization?.id,
    queryFn: () =>
      listApolloQueryLogs({
        prospect_id,
        organization_id: organization?.id,
        limit,
      }),
    staleTime: 15_000,
  });
}

export function useApolloReplay(prospect_id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => replayApolloQuery(prospect_id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apollo-query-logs'] });
      qc.invalidateQueries({ queryKey: ['enriched-contacts', prospect_id] });
    },
  });
}

export function useApolloRaw(prospect_id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (custom_titles?: string[]) => runApolloRaw(prospect_id!, custom_titles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apollo-query-logs'] });
      qc.invalidateQueries({ queryKey: ['enriched-contacts', prospect_id] });
    },
  });
}
