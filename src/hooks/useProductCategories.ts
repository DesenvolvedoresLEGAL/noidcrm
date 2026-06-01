import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductCategory } from '@/services/crm/product-categories';

// SPRINT PERF 0.4 — catálogo raramente alterado.
// Compartilha a chave ['product-categories'] com CategoriesTab/ProductCategories page,
// que invalidam após create/update/delete. Cache de 15min, sem refetchOnWindowFocus.
export function useProductCategories() {
  const query = useQuery({
    queryKey: ['product-categories', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as ProductCategory[];
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    categories: query.data ?? [],
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
