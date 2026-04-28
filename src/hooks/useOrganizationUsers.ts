import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrgUser {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

/**
 * Lists active members of the current user's organization.
 * Optionally accepts `extraUserIds` to ALSO include specific users (e.g. the
 * currently assigned owner/CS even if they are inactive or missing from the
 * default member list). This prevents Selects from rendering empty when the
 * saved value points to a user not returned by the standard query.
 */
export function useOrganizationUsers(extraUserIds: Array<string | null | undefined> = []) {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable key for effect deps
  const extrasKey = extraUserIds
    .filter((id): id is string => !!id)
    .sort()
    .join(',');

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);

        const orgId = await supabase.rpc('get_user_organization_id');
        if (!orgId.data) {
          throw new Error('User organization not found');
        }

        // Active members of the organization
        const { data: activeMembers, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', orgId.data)
          .eq('status', 'active');

        if (membersError) throw membersError;

        const memberIds = (activeMembers || []).map((m) => m.user_id);
        const extras = extrasKey ? extrasKey.split(',') : [];
        const unionIds = Array.from(new Set([...memberIds, ...extras]));

        if (unionIds.length === 0) {
          setUsers([]);
          return;
        }

        // Profiles for all union ids — fetch even if inactive so the form
        // displays the saved owner/CS/pre-sales values.
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', unionIds)
          .order('full_name');

        if (profilesError) throw profilesError;

        // Mark non-active extras with "(Inativo)" suffix for clarity
        const memberSet = new Set(memberIds);
        setUsers(
          (profiles || []).map((p) => {
            const isInactive = !memberSet.has(p.user_id);
            const baseName = p.full_name || 'Sem nome';
            return {
              id: p.user_id,
              name: isInactive ? `${baseName} (Inativo)` : baseName,
              email: p.email || undefined,
              avatar_url: p.avatar_url || undefined,
            };
          }),
        );
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [extrasKey]);

  return { users, loading, error };
}
