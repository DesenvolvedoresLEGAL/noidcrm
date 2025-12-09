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

// Fallback permissions by org_role (used when no permission_set is assigned)
const FALLBACK_PERMISSIONS: Record<string, { 
  permissions: PermissionSet; 
  defaultDashboard: string; 
  visibleMenus: string[];
}> = {
  owner: {
    permissions: {
      deals: { view: true, create: true, edit: true, delete: true, viewAll: true },
      contacts: { view: true, create: true, edit: true, delete: true, viewAll: true },
      activities: { view: true, create: true, edit: true, delete: true, viewAll: true },
      reports: { view: true, create: true, edit: true, delete: true, viewAll: true },
      settings: { view: true, create: true, edit: true, delete: true, viewAll: true },
      automation: { view: true, create: true, edit: true, delete: true, viewAll: true },
      teams: { view: true, create: true, edit: true, delete: true, viewAll: true },
    },
    defaultDashboard: 'OwnerDashboard',
    visibleMenus: ['principal', 'gestao', 'inteligencia', 'gtm'],
  },
  admin: {
    permissions: {
      deals: { view: true, create: true, edit: true, delete: true, viewAll: true },
      contacts: { view: true, create: true, edit: true, delete: true, viewAll: true },
      activities: { view: true, create: true, edit: true, delete: true, viewAll: true },
      reports: { view: true, create: true, edit: true, delete: true, viewAll: true },
      settings: { view: true, create: true, edit: true, delete: true, viewAll: true },
      automation: { view: true, create: true, edit: true, delete: true, viewAll: true },
      teams: { view: true, create: true, edit: true, delete: true, viewAll: true },
    },
    defaultDashboard: 'OwnerDashboard',
    visibleMenus: ['principal', 'gestao', 'inteligencia', 'gtm'],
  },
  manager: {
    permissions: {
      deals: { view: true, create: true, edit: true, delete: false, viewAll: true },
      contacts: { view: true, create: true, edit: true, delete: false, viewAll: true },
      activities: { view: true, create: true, edit: true, delete: true, viewAll: true },
      reports: { view: true, create: true, edit: true, delete: false, viewAll: true },
      settings: { view: true, create: false, edit: false, delete: false, viewAll: false },
      automation: { view: true, create: true, edit: true, delete: false, viewAll: true },
      teams: { view: true, create: true, edit: true, delete: false, viewAll: true },
    },
    defaultDashboard: 'ManagerDashboard',
    visibleMenus: ['principal', 'gestao', 'inteligencia'],
  },
  cs: {
    permissions: {
      deals: { view: true, create: true, edit: true, delete: false, viewAll: false },
      contacts: { view: true, create: true, edit: true, delete: false, viewAll: true },
      activities: { view: true, create: true, edit: true, delete: true, viewAll: false },
      reports: { view: true, create: false, edit: false, delete: false, viewAll: false },
      settings: { view: true, create: false, edit: false, delete: false, viewAll: false },
      automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
      teams: { view: true, create: false, edit: false, delete: false, viewAll: false },
    },
    defaultDashboard: 'CSDashboard',
    visibleMenus: ['principal', 'gestao', 'inteligencia'],
  },
  finance: {
    permissions: {
      deals: { view: true, create: false, edit: false, delete: false, viewAll: true },
      contacts: { view: true, create: false, edit: false, delete: false, viewAll: true },
      activities: { view: true, create: false, edit: false, delete: false, viewAll: true },
      reports: { view: true, create: true, edit: true, delete: false, viewAll: true },
      settings: { view: true, create: false, edit: false, delete: false, viewAll: false },
      automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
      teams: { view: true, create: false, edit: false, delete: false, viewAll: true },
    },
    defaultDashboard: 'FinanceDashboard',
    visibleMenus: ['principal', 'gestao', 'inteligencia'],
  },
  sales: {
    permissions: {
      deals: { view: true, create: true, edit: true, delete: false, viewAll: false },
      contacts: { view: true, create: true, edit: true, delete: false, viewAll: false },
      activities: { view: true, create: true, edit: true, delete: true, viewAll: false },
      reports: { view: true, create: false, edit: false, delete: false, viewAll: false },
      settings: { view: true, create: false, edit: false, delete: false, viewAll: false },
      automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
      teams: { view: true, create: false, edit: false, delete: false, viewAll: false },
    },
    defaultDashboard: 'RepDashboard',
    visibleMenus: ['principal', 'gestao'],
  },
  viewer: {
    permissions: {
      deals: { view: true, create: false, edit: false, delete: false, viewAll: false },
      contacts: { view: true, create: false, edit: false, delete: false, viewAll: false },
      activities: { view: true, create: false, edit: false, delete: false, viewAll: false },
      reports: { view: true, create: false, edit: false, delete: false, viewAll: false },
      settings: { view: false, create: false, edit: false, delete: false, viewAll: false },
      automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
      teams: { view: false, create: false, edit: false, delete: false, viewAll: false },
    },
    defaultDashboard: 'RepDashboard',
    visibleMenus: ['principal'],
  },
};

export function usePermissions() {
  const { user } = useSupabaseAuth();
  const [permissions, setPermissions] = useState<PermissionSet>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isCS, setIsCS] = useState(false);
  const [isFinance, setIsFinance] = useState(false);
  const [defaultDashboard, setDefaultDashboard] = useState<string>('RepDashboard');
  const [visibleMenus, setVisibleMenus] = useState<string[]>(['principal', 'gestao']);
  const [orgRole, setOrgRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPermissions({});
      setIsAdmin(false);
      setIsOwner(false);
      setIsManager(false);
      setIsCS(false);
      setIsFinance(false);
      setDefaultDashboard('RepDashboard');
      setVisibleMenus(['principal', 'gestao']);
      setOrgRole(null);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // Get user's role and permission set
        const { data: memberships, error: memberError } = await supabase
          .from('organization_members')
          .select(`
            org_role, 
            permission_set_id, 
            permission_sets(
              permissions,
              default_dashboard,
              visible_menus
            )
          `)
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
          setDefaultDashboard('RepDashboard');
          setVisibleMenus(['principal', 'gestao']);
          setOrgRole(null);
          setLoading(false);
          return;
        }

        const role = memberData.org_role;
        setOrgRole(role);
        
        // Set role flags
        setIsAdmin(role === 'admin' || role === 'owner');
        setIsOwner(role === 'owner');
        setIsManager(role === 'manager');
        setIsCS(role === 'cs');
        setIsFinance(role === 'finance');

        // Priority 1: Use permission_set if assigned
        if (memberData.permission_sets) {
          const permSet = memberData.permission_sets as any;
          const perms = permSet.permissions || {};
          const dashboard = permSet.default_dashboard || 'RepDashboard';
          const menus = permSet.visible_menus || ['principal', 'gestao'];

          setPermissions(perms);
          setDefaultDashboard(dashboard);
          setVisibleMenus(Array.isArray(menus) ? menus : ['principal', 'gestao']);
        } 
        // Priority 2: Use fallback based on org_role
        else if (role && FALLBACK_PERMISSIONS[role]) {
          const fallback = FALLBACK_PERMISSIONS[role];
          setPermissions(fallback.permissions);
          setDefaultDashboard(fallback.defaultDashboard);
          setVisibleMenus(fallback.visibleMenus);
        } 
        // Default: basic sales permissions
        else {
          const fallback = FALLBACK_PERMISSIONS.sales;
          setPermissions(fallback.permissions);
          setDefaultDashboard(fallback.defaultDashboard);
          setVisibleMenus(fallback.visibleMenus);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions({});
        setDefaultDashboard('RepDashboard');
        setVisibleMenus(['principal', 'gestao']);
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
    defaultDashboard,
    visibleMenus,
    orgRole,
    can,
  };
}
