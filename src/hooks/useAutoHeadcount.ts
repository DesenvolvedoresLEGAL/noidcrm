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
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['auto-headcount', organization?.id],
    queryFn: async () => {
      if (!organization?.id) {
        return { total: 0, salesTeam: 0, byRole: [] };
      }
      
      // Get organization members - filter by active status
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('id, user_id, org_role, status')
        .eq('organization_id', organization.id)
        .eq('status', 'active');
      
      if (error) {
        console.error('Error fetching headcount:', error);
        throw error;
      }
      
      // Group by role
      const roleGroups: Record<string, { count: number; members: { id: string; name: string; email: string }[] }> = {};
      
      members?.forEach(member => {
        const role = member.org_role || 'member';
        if (!roleGroups[role]) {
          roleGroups[role] = { count: 0, members: [] };
        }
        roleGroups[role].count += 1;
        roleGroups[role].members.push({
          id: member.user_id,
          name: role,
          email: '',
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
      
      // Calculate totals - count 'sales' role as closers/sales team
      const total = members?.length || 0;
      const salesTeam = members?.filter(m => 
        m.org_role === 'sales'
      ).length || 0;
      
      console.log('Headcount calculated:', { total, salesTeam, byRole });
      
      return { total, salesTeam, byRole };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Log if there's an error
  if (error) {
    console.error('useAutoHeadcount error:', error);
  }

  return {
    total: data?.total || 0,
    salesTeam: data?.salesTeam || 0,
    byRole: data?.byRole || [],
    isLoading,
  };
}
