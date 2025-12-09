import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';

export interface Permission {
  module: string;
  actions: {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
    viewAll?: boolean; // View all records vs only owned
  };
}

export interface PermissionSet {
  deals?: Permission['actions'];
  contacts?: Permission['actions'];
  activities?: Permission['actions'];
  reports?: Permission['actions'];
  settings?: Permission['actions'];
  automation?: Permission['actions'];
  teams?: Permission['actions'];
}

export function usePermissions() {
  const { user } = useSupabaseAuth();
  const [permissions, setPermissions] = useState<PermissionSet>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isCS, setIsCS] = useState(false);
  const [isFinance, setIsFinance] = useState(false);

  useEffect(() => {
    if (!user) {
      setPermissions({});
      setIsAdmin(false);
      setIsOwner(false);
      setIsManager(false);
      setIsCS(false);
      setIsFinance(false);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // Get user's role and permission set - order by most recent and take first
        const { data: memberships, error: memberError } = await supabase
          .from('organization_members')
          .select('org_role, permission_set_id, permission_sets(permissions)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('joined_at', { ascending: false, nullsFirst: false })
          .limit(1);

        if (memberError) throw memberError;

        const memberData = memberships?.[0];

        if (!memberData) {
          setPermissions({});
          setIsAdmin(false);
          setIsOwner(false);
          setIsManager(false);
          setIsCS(false);
          setIsFinance(false);
          setLoading(false);
          return;
        }

        // Check if user is admin or owner
        const role = memberData.org_role;
        setIsAdmin(role === 'admin' || role === 'owner');
        setIsOwner(role === 'owner');
        setIsManager(role === 'manager');
        setIsCS(role === 'cs');
        setIsFinance(role === 'finance');

        // Admins and owners have full permissions
        if (role === 'admin' || role === 'owner') {
          setPermissions({
            deals: { view: true, create: true, edit: true, delete: true, viewAll: true },
            contacts: { view: true, create: true, edit: true, delete: true, viewAll: true },
            activities: { view: true, create: true, edit: true, delete: true, viewAll: true },
            reports: { view: true, create: true, edit: true, delete: true, viewAll: true },
            settings: { view: true, create: true, edit: true, delete: true, viewAll: true },
            automation: { view: true, create: true, edit: true, delete: true, viewAll: true },
            teams: { view: true, create: true, edit: true, delete: true, viewAll: true },
          });
        } else if (role === 'cs') {
          // CS permissions - focused on customer success activities
          setPermissions({
            deals: { view: true, create: true, edit: true, delete: false, viewAll: false },
            contacts: { view: true, create: true, edit: true, delete: false, viewAll: true },
            activities: { view: true, create: true, edit: true, delete: true, viewAll: false },
            reports: { view: true, create: false, edit: false, delete: false, viewAll: false },
            settings: { view: true, create: false, edit: false, delete: false, viewAll: false },
            automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
            teams: { view: true, create: false, edit: false, delete: false, viewAll: false },
          });
        } else if (role === 'finance') {
          // Finance permissions - focused on financial visibility and reports
          setPermissions({
            deals: { view: true, create: false, edit: false, delete: false, viewAll: true },
            contacts: { view: true, create: false, edit: false, delete: false, viewAll: true },
            activities: { view: true, create: false, edit: false, delete: false, viewAll: true },
            reports: { view: true, create: true, edit: true, delete: false, viewAll: true },
            settings: { view: true, create: false, edit: false, delete: false, viewAll: false },
            automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
            teams: { view: true, create: false, edit: false, delete: false, viewAll: true },
          });
        } else if (memberData.permission_sets) {
          // Use custom permission set
          const perms = (memberData.permission_sets as any).permissions || {};
          setPermissions(perms);
        } else {
          // Default sales permissions
          setPermissions({
            deals: { view: true, create: true, edit: true, delete: false, viewAll: false },
            contacts: { view: true, create: true, edit: true, delete: false, viewAll: false },
            activities: { view: true, create: true, edit: true, delete: true, viewAll: false },
            reports: { view: true, create: false, edit: false, delete: false, viewAll: false },
            settings: { view: true, create: false, edit: false, delete: false, viewAll: false },
            automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
            teams: { view: true, create: false, edit: false, delete: false, viewAll: false },
          });
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions({});
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  const can = (module: keyof PermissionSet, action: keyof Permission['actions']) => {
    return permissions[module]?.[action] === true;
  };

  return {
    permissions,
    loading,
    isAdmin,
    isOwner,
    isManager,
    isCS,
    isFinance,
    can,
  };
}
