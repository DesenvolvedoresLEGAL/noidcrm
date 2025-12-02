import { supabase } from '@/integrations/supabase/client';

export interface ProposalParticipant {
  id: string;
  proposal_id: string;
  user_id: string;
  organization_id: string;
  role: 'owner' | 'collaborator' | 'reviewer' | 'approver';
  can_edit: boolean;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export async function listProposalParticipants(proposalId: string): Promise<ProposalParticipant[]> {
  const { data, error } = await supabase
    .from('proposal_participants')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Fetch user profiles
  const userIds = data?.map(p => p.user_id) || [];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, avatar_url')
    .in('user_id', userIds);

  return (data || []).map(p => ({
    ...p,
    role: p.role as ProposalParticipant['role'],
    user: profiles?.find(profile => profile.user_id === p.user_id) as any
  }));
}

export async function addProposalParticipant(
  proposalId: string,
  userId: string,
  role: ProposalParticipant['role'] = 'collaborator',
  canEdit: boolean = false
): Promise<ProposalParticipant> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('proposal_participants')
    .insert({
      proposal_id: proposalId,
      user_id: userId,
      organization_id: orgId,
      role,
      can_edit: canEdit,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProposalParticipant;
}

export async function updateProposalParticipant(
  id: string,
  updates: { role?: ProposalParticipant['role']; can_edit?: boolean }
): Promise<ProposalParticipant> {
  const { data, error } = await supabase
    .from('proposal_participants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProposalParticipant;
}

export async function removeProposalParticipant(id: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_participants')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
