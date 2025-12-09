import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizationUsers() {
  const [users, setUsers] = useState<Array<{ id: string; name: string; email?: string; avatar_url?: string }>>([]);
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
        
        // Query 1: Buscar user_ids de membros ATIVOS
        const { data: activeMembers, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', orgId.data)
          .eq('status', 'active');
        
        if (membersError) throw membersError;
        
        if (!activeMembers || activeMembers.length === 0) {
          setUsers([]);
          return;
        }
        
        // Query 2: Buscar profiles dos membros ativos
        const userIds = activeMembers.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds)
          .eq('organization_id', orgId.data)
          .order('full_name');
        
        if (profilesError) throw profilesError;
        
        setUsers(profiles?.map(p => ({
          id: p.user_id,
          name: p.full_name || 'Sem nome',
          email: p.email || undefined,
          avatar_url: p.avatar_url || undefined
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
