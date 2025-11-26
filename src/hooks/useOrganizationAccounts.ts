import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizationAccounts() {
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        setLoading(true);
        
        const orgId = await supabase.rpc('get_user_organization_id');
        
        if (!orgId.data) {
          throw new Error('User organization not found');
        }
        
        const { data: accountsData, error: fetchError } = await supabase
          .from('accounts')
          .select('id, razao_social, nome_fantasia')
          .eq('organization_id', orgId.data)
          .order('razao_social');
        
        if (fetchError) throw fetchError;
        
        setAccounts(accountsData?.map(a => ({
          id: a.id,
          name: a.nome_fantasia || a.razao_social
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching accounts:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAccounts();
  }, []);

  return { accounts, loading, error };
}
