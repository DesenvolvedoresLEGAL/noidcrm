import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  parent_team_id: string | null;
  manager_id: string | null;
  monthly_goal: number;
  color: string;
  created_at: string;
  updated_at: string;
  manager?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  members?: TeamMember[];
  subteams?: Team[];
}

export interface TeamMember {
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

export function useTeams() {
  const { organization } = useCurrentOrganization();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) {
      setTeams([]);
      setLoading(false);
      return;
    }

    const fetchTeams = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .eq('organization_id', organization.id)
          .order('name');

        if (error) throw error;

        // Fetch manager profiles separately
        if (data && data.length > 0) {
          const managerIds = data
            .map(t => t.manager_id)
            .filter((id): id is string => !!id);
          
          let profileMap = new Map();
          if (managerIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, full_name, avatar_url')
              .in('user_id', managerIds);
            
            profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
          }

          const teamsWithManagers = data.map(t => ({
            ...t,
            manager: t.manager_id ? profileMap.get(t.manager_id) : undefined
          }));

          setTeams(teamsWithManagers);
        } else {
          setTeams(data || []);
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [organization?.id]);

  const createTeam = async (team: Partial<Team>) => {
    if (!organization?.id) return { error: new Error('No organization') };

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          organization_id: organization.id,
          name: team.name!,
          description: team.description,
          parent_team_id: team.parent_team_id,
          manager_id: team.manager_id,
          monthly_goal: team.monthly_goal || 0,
          color: team.color || '#6366f1',
        })
        .select()
        .single();

      if (error) throw error;

      setTeams([...teams, data]);
      return { data, error: null };
    } catch (error) {
      console.error('Error creating team:', error);
      return { data: null, error };
    }
  };

  const updateTeam = async (id: string, updates: Partial<Team>) => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTeams(teams.map(t => t.id === id ? data : t));
      return { data, error: null };
    } catch (error) {
      console.error('Error updating team:', error);
      return { data: null, error };
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTeams(teams.filter(t => t.id !== id));
      return { error: null };
    } catch (error) {
      console.error('Error deleting team:', error);
      return { error };
    }
  };

  return {
    teams,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
  };
}
