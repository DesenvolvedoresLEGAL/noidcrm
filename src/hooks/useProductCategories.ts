import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProductCategory } from '@/services/crm/product-categories';

export function useProductCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('product_categories')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (fetchError) throw fetchError;
        
        setCategories(data || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCategories();
  }, []);

  return { categories, loading, error };
}
