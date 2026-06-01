import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// SPRINT PERF 0.4 — catálogo estável (produtos ativos).
// Cache 10min, sem refetchOnWindowFocus. Mutations em /products invalidam ['organization-products'].
export function useOrganizationProducts() {
  const query = useQuery({
    queryKey: ['organization-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    products: query.data ?? [],
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
