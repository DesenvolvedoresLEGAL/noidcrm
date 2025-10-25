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
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'suspended';
  joined_at: string | null;
  created_at: string;
}

export function useCurrentOrganization() {
  const { user } = useSupabaseAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrganization(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const fetchOrganization = async () => {
      try {
        const { data: membershipData, error: membershipError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (membershipError) throw membershipError;

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
  }, [user]);

  const isOwner = membership?.role === 'owner';
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  return {
    organization,
    membership,
    loading,
    isOwner,
    isAdmin,
  };
}
