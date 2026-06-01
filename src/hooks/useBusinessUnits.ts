import { useQuery } from '@tanstack/react-query';
import { listBusinessUnits, type BusinessUnit } from '@/services/crm/business-units';

// SPRINT PERF 0.4 — catálogo de configuração raramente alterado.
// Cache 15min, sem refetchOnWindowFocus. refetch() exposto para a página
// de settings invalidar após create/update/delete.
export function useBusinessUnits() {
  const query = useQuery<BusinessUnit[], Error>({
    queryKey: ['business-units'],
    queryFn: listBusinessUnits,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    businessUnits: query.data ?? [],
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refetch: async () => {
      await query.refetch();
    },
  };
}
