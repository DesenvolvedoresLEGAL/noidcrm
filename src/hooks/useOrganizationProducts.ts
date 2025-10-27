import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizationProducts() {
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('products')
          .select('id, name')
          .eq('active', true)
          .order('name');
        
        if (fetchError) throw fetchError;
        
        setProducts(data || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProducts();
  }, []);

  return { products, loading, error };
}
