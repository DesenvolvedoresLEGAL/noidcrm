import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';

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

export function useCurrentOrganization() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // AUTH.1.3: enquanto o boot do Supabase Auth não termina, não decide nada.
    // Evita falso "sem organização" durante restauração de sessão.
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setOrganization(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const fetchOrganization = async () => {
      try {
        // Fetch all active memberships and get the first one
        // (ordered by joined_at to get the primary organization)
        const { data: memberships, error: membershipError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('joined_at', { ascending: false, nullsFirst: false })
          .limit(1);

        if (membershipError) throw membershipError;

        const membershipData = memberships?.[0];
        
        if (!membershipData) {
          setOrganization(null);
          setMembership(null);
          setLoading(false);
          return;
        }

        setMembership(membershipData as OrganizationMember);

        if (membershipData?.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', membershipData.organization_id)
            .single();

          if (orgError) throw orgError;
          setOrganization(orgData as Organization);
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
        setOrganization(null);
        setMembership(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [user, authLoading]);

  // Unificado: usar org_role (campo correto da tabela organization_members)
  const isOwner = membership?.org_role === 'owner';
  const isAdmin = membership?.org_role === 'owner' || membership?.org_role === 'admin';
  const isCS = membership?.org_role === 'cs';

  return {
    organization,
    membership,
    loading,
    isOwner,
    isAdmin,
    isCS,
  };
}
