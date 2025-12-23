import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

export interface Seller {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  active: boolean;
  current_fit_score: number | null;
}

export function useSellers() {
  const { organization } = useCurrentOrganization();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSellers() {
      if (!organization?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('sellers')
          .select('id, user_id, name, email, role, active, current_fit_score')
          .eq('organization_id', organization.id)
          .eq('active', true)
          .order('name');

        if (fetchError) throw fetchError;
        setSellers(data || []);
      } catch (err) {
        console.error('Error fetching sellers:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchSellers();
  }, [organization?.id]);

  return { sellers, loading, error };
}
