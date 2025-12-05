import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Manager {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

export function useAvailableManagers() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchManagers() {
      try {
        setLoading(true);
        
        const orgId = await supabase.rpc('get_user_organization_id');
        
        if (!orgId.data) {
          throw new Error('User organization not found');
        }
        
        // Buscar membros com role manager, admin ou owner
        const { data: eligibleMembers, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id, role, org_role')
          .eq('organization_id', orgId.data)
          .eq('status', 'active')
          .or('role.eq.owner,role.eq.admin,org_role.eq.manager,org_role.eq.admin,org_role.eq.owner');
        
        if (membersError) throw membersError;
        
        if (!eligibleMembers || eligibleMembers.length === 0) {
          setManagers([]);
          return;
        }
        
        // Buscar profiles dos elegíveis
        const userIds = eligibleMembers.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);
        
        if (profilesError) throw profilesError;
        
        setManagers(profiles?.map(p => ({
          id: p.user_id,
          name: p.full_name || 'Sem nome',
          email: p.email || undefined,
          avatar_url: p.avatar_url || undefined
        })) || []);
      } catch (err) {
        console.error('Error fetching managers:', err);
        setManagers([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchManagers();
  }, []);

  return { managers, loading };
}
