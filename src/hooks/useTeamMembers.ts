import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMemberWithProfile {
  id: string;
  team_id: string;
  user_id: string;
  role: string | null;
  created_at: string | null;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useTeamMembers(teamId: string | null) {
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!teamId) {
      setMembers([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, team_id, user_id, role, created_at')
        .eq('team_id', teamId);

      if (error) throw error;

      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        const membersWithProfiles: TeamMemberWithProfile[] = data.map(m => ({
          ...m,
          profile: profileMap.get(m.user_id) || undefined
        }));

        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (userId: string) => {
    if (!teamId) return { error: new Error('No team selected') };

    try {
      // Buscar organization_id do time
      const { data: teamData } = await supabase
        .from('teams')
        .select('organization_id')
        .eq('id', teamId)
        .single();

      if (!teamData) throw new Error('Team not found');

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: userId,
          organization_id: teamData.organization_id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      return { data, error: null };
    } catch (error) {
      console.error('Error adding team member:', error);
      return { data: null, error };
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== memberId));
      return { error: null };
    } catch (error) {
      console.error('Error removing team member:', error);
      return { error };
    }
  };

  return {
    members,
    loading,
    addMember,
    removeMember,
    refetch: fetchMembers,
  };
}
