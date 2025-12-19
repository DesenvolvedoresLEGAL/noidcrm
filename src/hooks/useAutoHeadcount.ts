import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export interface RoleHeadcount {
  role: string;
  label: string;
  count: number;
  members: { id: string; name: string; email: string }[];
}

export interface HeadcountData {
  total: number;
  salesTeam: number;
  byRole: RoleHeadcount[];
  isLoading: boolean;
}

// Map org_role to display labels
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  sales: 'Vendedor/Closer',
  sdr: 'SDR',
  farmer: 'Farmer',
  cs: 'Customer Success',
  manager: 'Gerente',
  member: 'Membro',
};

// Roles that count as sales team
const SALES_ROLES = ['sales', 'sdr', 'farmer', 'closer'];

export function useAutoHeadcount(): HeadcountData {
  const { organization } = useCurrentUser();
  
  const { data, isLoading } = useQuery({
    queryKey: ['auto-headcount', organization?.id],
    queryFn: async () => {
      if (!organization?.id) {
        return { total: 0, salesTeam: 0, byRole: [] };
      }
      
      // Get organization members with their profiles
      const { data: members, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          org_role,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('organization_id', organization.id);
      
      if (error) throw error;
      
      // Group by role
      const roleGroups: Record<string, { count: number; members: { id: string; name: string; email: string }[] }> = {};
      
      members?.forEach(member => {
        const role = member.org_role || 'member';
        if (!roleGroups[role]) {
          roleGroups[role] = { count: 0, members: [] };
        }
        roleGroups[role].count += 1;
        
        const profile = member.profiles as any;
        roleGroups[role].members.push({
          id: member.user_id,
          name: profile?.full_name || 'Sem nome',
          email: profile?.email || '',
        });
      });
      
      // Convert to array
      const byRole: RoleHeadcount[] = Object.entries(roleGroups)
        .map(([role, data]) => ({
          role,
          label: ROLE_LABELS[role] || role,
          count: data.count,
          members: data.members,
        }))
        .sort((a, b) => b.count - a.count);
      
      // Calculate totals
      const total = members?.length || 0;
      const salesTeam = members?.filter(m => 
        SALES_ROLES.includes(m.org_role || '')
      ).length || 0;
      
      return { total, salesTeam, byRole };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    total: data?.total || 0,
    salesTeam: data?.salesTeam || 0,
    byRole: data?.byRole || [],
    isLoading,
  };
}
