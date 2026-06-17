import { useCurrentUser } from './useCurrentUser';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string;
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at: string | null;
  settings: any;
  max_users: number;
  max_opportunities: number;
  created_at: string;
  updated_at: string;
  is_plan_locked?: boolean | null;
  goal_system_mode?: 'ote' | 'simple' | 'standard_commission';
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  org_role: 'owner' | 'admin' | 'manager' | 'sales' | 'viewer' | 'cs';
  status: 'active' | 'invited' | 'suspended';
  joined_at: string | null;
  created_at: string;
}

/**
 * HOTFIX: Antes este hook fazia consultas diretas a `organizations` e
 * `organization_members` via cliente Supabase. Em condições de corrida (logo
 * após signIn, antes de o Authorization header propagar ou em refresh de
 * token), a request saía como anon e a RLS retornava 0 linhas — gerando
 * PGRST116 / 406 em loop e impedindo o usuário de acessar o sistema.
 *
 * Agora consome a fonte única `useCurrentUser`, que usa a edge function
 * `get-current-user` (service role) e já entrega organização + membership
 * de forma consistente, com cache, retry e revalidação.
 */
export function useCurrentOrganization() {
  const { organization, membership, loading } = useCurrentUser();

  const org = (organization ?? null) as unknown as Organization | null;
  const mem = (membership ?? null) as unknown as OrganizationMember | null;

  const isOwner = mem?.org_role === 'owner';
  const isAdmin = mem?.org_role === 'owner' || mem?.org_role === 'admin';
  const isCS = mem?.org_role === 'cs';

  return {
    organization: org,
    membership: mem,
    loading,
    isOwner,
    isAdmin,
    isCS,
  };
}
