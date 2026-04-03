import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizationContacts(accountId?: string) {
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; accountId: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchContacts() {
      try {
        setLoading(true);
        
        const orgId = await supabase.rpc('get_user_organization_id');
        
        if (!orgId.data) {
          throw new Error('User organization not found');
        }
        
        let query = supabase
          .from('contacts')
          .select('id, nome, primeiro_nome, ultimo_nome, account_id')
          .eq('organization_id', orgId.data);

        // Filtrar por conta se fornecido
        if (accountId) {
          query = query.eq('account_id', accountId);
        }
        
        const { data: contactsData, error: fetchError } = await query.order('nome');
        
        if (fetchError) throw fetchError;
        
        setContacts(contactsData?.map(c => ({
          id: c.id,
          name: c.nome,
          accountId: c.account_id
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching contacts:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchContacts();
  }, [accountId]);

  return { contacts, loading, error };
}
