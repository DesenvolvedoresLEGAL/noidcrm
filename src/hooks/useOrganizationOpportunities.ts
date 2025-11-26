import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizationOpportunities(accountId?: string) {
  const [opportunities, setOpportunities] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true);
        
        const orgId = await supabase.rpc('get_user_organization_id');
        
        if (!orgId.data) {
          throw new Error('User organization not found');
        }
        
        let query = supabase
          .from('opportunities')
          .select('id, title')
          .eq('organization_id', orgId.data)
          .in('status', ['new', 'in_progress']);

        // Filtrar por conta se fornecido
        if (accountId) {
          query = query.eq('account_id', accountId);
        }
        
        const { data: oppsData, error: fetchError } = await query.order('title');
        
        if (fetchError) throw fetchError;
        
        setOpportunities(oppsData?.map(o => ({
          id: o.id,
          title: o.title
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching opportunities:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOpportunities();
  }, [accountId]);

  return { opportunities, loading, error };
}
