import { useQuery } from '@tanstack/react-query';
import { listPipelines, type Pipeline } from '@/services/crm/pipelines';

// Standalone key kept here (rarely touched, only one consumer chain).
const ORGANIZATION_PIPELINES_KEY = ['organization-pipelines'] as const;

export function useOrganizationPipelines(enabled = true) {
  const query = useQuery<Pipeline[], Error>({
    queryKey: ORGANIZATION_PIPELINES_KEY,
    queryFn: listPipelines,
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    pipelines: query.data ?? [],
    loading: query.isLoading && !query.data,
    error: query.error ?? null,
  };
}
