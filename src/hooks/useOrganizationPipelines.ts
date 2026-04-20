import { useQuery } from '@tanstack/react-query';
import { listPipelines, type Pipeline } from '@/services/crm/pipelines';

export function useOrganizationPipelines(enabled = true) {
  const query = useQuery<Pipeline[], Error>({
    queryKey: ['organization-pipelines'],
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
