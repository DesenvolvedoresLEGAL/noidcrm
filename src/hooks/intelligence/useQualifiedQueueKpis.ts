import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getQualifiedQueueKpis, type QualifiedQueueKpis } from '@/services/intelligence/qualifiedQueue';

export function useQualifiedQueueKpis() {
  const { organization } = useCurrentUser();
  return useQuery<QualifiedQueueKpis>({
    queryKey: ['kairos-qualified-queue-kpis', organization?.id],
    enabled: !!organization?.id,
    queryFn: () => getQualifiedQueueKpis(organization!.id),
    staleTime: 30_000,
  });
}
