import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccountTagIds, setAccountTags, listAccountTagsBulk } from '@/services/supabase/account-tags';
import { accountKeys } from '@/lib/query-keys';

export function useAccountTagIds(accountId: string | undefined) {
  return useQuery({
    queryKey: ['account-tags', accountId],
    queryFn: () => (accountId ? getAccountTagIds(accountId) : Promise.resolve([])),
    enabled: !!accountId,
  });
}

export function useSetAccountTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, tagIds }: { accountId: string; tagIds: string[] }) =>
      setAccountTags(accountId, tagIds),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['account-tags', vars.accountId] });
      qc.invalidateQueries({ queryKey: ['account-tags-bulk'] });
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

export function useAccountTagsBulk(accountIds: string[]) {
  const key = [...accountIds].sort().join(',');
  return useQuery({
    queryKey: ['account-tags-bulk', key],
    queryFn: () => listAccountTagsBulk(accountIds),
    enabled: accountIds.length > 0,
    staleTime: 30_000,
  });
}
