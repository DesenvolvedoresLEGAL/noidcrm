import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizationUsers() {
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        
        // Buscar organização do usuário atual
        const orgId = await supabase.rpc('get_user_organization_id');
        
        if (!orgId.data) {
          throw new Error('User organization not found');
        }
        
        // Buscar apenas usuários da mesma organização
        const { data: profiles, error: fetchError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('organization_id', orgId.data)
          .order('full_name');
        
        if (fetchError) throw fetchError;
        
        setUsers(profiles?.map(p => ({
          id: p.user_id,
          name: p.full_name || 'Sem nome'
        })) || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUsers();
  }, []);

  return { users, loading, error };
}
