import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  listQualifiedQueue,
  type QualifiedQueueFilters,
  type QualifiedQueueItem,
} from '@/services/intelligence/qualifiedQueue';

export function useQualifiedQueue(filters: QualifiedQueueFilters = {}) {
  const { organization } = useCurrentUser();
  return useQuery<QualifiedQueueItem[]>({
    queryKey: ['kairos-qualified-queue', organization?.id, filters],
    enabled: !!organization?.id,
    queryFn: () => listQualifiedQueue(organization!.id, filters),
    staleTime: 30_000,
  });
}
