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

// Menu items visíveis por papel - controle granular por item individual
const VISIBLE_MENU_ITEMS: Record<string, string[]> = {
  // SALES / CS / OPERACIONAL - menus básicos + inteligência essencial
  sales: [
    '/app/dashboard', '/app/opportunities',
    '/app/activities', '/app/accounts', '/app/contracts', '/app/reports',
    '/app/insights', '/app/scoring', '/app/intelligence/vibe', '/app/intelligence/winloss',
    '/app/roleplay',
  ],
  cs: [
    '/app/dashboard', '/app/opportunities',
    '/app/activities', '/app/accounts', '/app/contracts', '/app/reports',
    '/app/insights', '/app/scoring', '/app/intelligence/vibe', '/app/intelligence/winloss',
    '/app/roleplay',
  ],
  operations: [
    '/app/dashboard', '/app/opportunities',
    '/app/activities', '/app/accounts', '/app/contracts', '/app/reports',
    '/app/insights', '/app/scoring', '/app/intelligence/vibe', '/app/intelligence/winloss',
    '/app/roleplay',
  ],
  
  // MANAGER - vê gestão completa + inteligência + GTM manager
  manager: [
    '/app/dashboard', '/app/opportunities',
    '/app/activities', '/app/accounts', '/app/contracts', '/app/forecast', '/app/reports',
    '/app/insights', '/app/intelligence/graph', '/app/intelligence/memories',
    '/app/intelligence/playbooks',
    '/app/scoring', '/app/intelligence/vibe', '/app/intelligence/winloss',
    '/app/settings/sales', '/app/reports/ote', '/app/roleplay',
    '/app/gtm/manager',
  ],
  
  // FINANCE - foco em relatórios e resultados
  finance: [
    '/app/dashboard', '/app/opportunities',
    '/app/activities', '/app/accounts', '/app/contracts', '/app/forecast', '/app/reports',
    '/app/insights', '/app/scoring', '/app/intelligence/winloss',
    '/app/settings/sales', '/app/reports/ote',
  ],
  
  // ADMIN / OWNER - veem TUDO
  admin: ['*'],
  owner: ['*'],
  
  // Viewer - mínimo
  viewer: [
    '/app/dashboard', '/app/opportunities',
    '/app/activities',
  ],
};

// Fallback permissions by org_role (used when no permission_set is assigned)
const FALLBACK_PERMISSIONS: Record<string, { 
  permissions: PermissionSet; 
  defaultDashboard: string; 
  visibleMenus: string[];
  visibleMenuItems: string[];
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
    visibleMenus: ['principal', 'gestao', 'inteligencia', 'financeiro', 'gtm'],
    visibleMenuItems: VISIBLE_MENU_ITEMS.owner,
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
    visibleMenus: ['principal', 'gestao', 'inteligencia', 'financeiro', 'gtm'],
    visibleMenuItems: VISIBLE_MENU_ITEMS.admin,
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
    visibleMenus: ['principal', 'gestao', 'inteligencia', 'financeiro'],
    visibleMenuItems: VISIBLE_MENU_ITEMS.manager,
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
    visibleMenuItems: VISIBLE_MENU_ITEMS.cs,
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
    visibleMenus: ['principal', 'gestao', 'inteligencia', 'financeiro'],
    visibleMenuItems: VISIBLE_MENU_ITEMS.finance,
  },
  operations: {
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
    visibleMenus: ['principal', 'gestao', 'inteligencia'],
    visibleMenuItems: VISIBLE_MENU_ITEMS.operations,
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
    visibleMenus: ['principal', 'gestao', 'inteligencia'],
    visibleMenuItems: VISIBLE_MENU_ITEMS.sales,
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
    visibleMenuItems: VISIBLE_MENU_ITEMS.viewer,
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
  const [visibleMenuItems, setVisibleMenuItems] = useState<string[]>([]);
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
      setVisibleMenuItems(VISIBLE_MENU_ITEMS.sales);
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
          setVisibleMenuItems(VISIBLE_MENU_ITEMS.sales);
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
          // Use role-based menu items mesmo com permission_set
          setVisibleMenuItems(VISIBLE_MENU_ITEMS[role] || VISIBLE_MENU_ITEMS.sales);
        } 
        // Priority 2: Use fallback based on org_role
        else if (role && FALLBACK_PERMISSIONS[role]) {
          const fallback = FALLBACK_PERMISSIONS[role];
          setPermissions(fallback.permissions);
          setDefaultDashboard(fallback.defaultDashboard);
          setVisibleMenus(fallback.visibleMenus);
          setVisibleMenuItems(fallback.visibleMenuItems);
        } 
        // Default: basic sales permissions
        else {
          const fallback = FALLBACK_PERMISSIONS.sales;
          setPermissions(fallback.permissions);
          setDefaultDashboard(fallback.defaultDashboard);
          setVisibleMenus(fallback.visibleMenus);
          setVisibleMenuItems(fallback.visibleMenuItems);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions({});
        setDefaultDashboard('RepDashboard');
        setVisibleMenus(['principal', 'gestao']);
        setVisibleMenuItems(VISIBLE_MENU_ITEMS.sales);
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
    visibleMenuItems,
    orgRole,
    can,
  };
}
