import { supabase } from '@/integrations/supabase/client';
import { logParticipantEvent } from './timeline-logger';

export interface DealParticipant {
  id: string;
  opportunity_id: string;
  user_id: string;
  organization_id: string;
  role: 'owner' | 'collaborator' | 'observer';
  share_percentage: number;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export async function listDealParticipants(opportunityId: string): Promise<DealParticipant[]> {
  const { data, error } = await supabase
    .from('deal_participants')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Buscar dados dos usuários separadamente
  const userIds = data?.map(p => p.user_id) || [];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, avatar_url')
    .in('user_id', userIds);

  // Combinar os dados
  return (data || []).map(p => ({
    ...p,
    user: profiles?.find(profile => profile.user_id === p.user_id) as any
  })) as DealParticipant[];
}

export async function addDealParticipant(
  opportunityId: string,
  userId: string,
  role: 'collaborator' | 'observer' = 'collaborator',
  sharePercentage: number = 0
): Promise<DealParticipant> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('deal_participants')
    .insert({
      opportunity_id: opportunityId,
      user_id: userId,
      organization_id: orgId,
      role,
      share_percentage: sharePercentage,
    })
    .select()
    .single();

  if (error) throw error;
  
  // Get user name for logging
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .single();
  
  // Log to timeline
  await logParticipantEvent(opportunityId, 'participant_added', profile?.full_name || 'Usuário', role, sharePercentage);
  
  return data as DealParticipant;
}

export async function updateDealParticipant(
  id: string,
  updates: { role?: string; share_percentage?: number }
): Promise<DealParticipant> {
  const { data, error } = await supabase
    .from('deal_participants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DealParticipant;
}

export async function removeDealParticipant(id: string, opportunityId: string, participantName?: string): Promise<void> {
  const { error } = await supabase
    .from('deal_participants')
    .delete()
    .eq('id', id);

  if (error) throw error;
  
  // Log to timeline
  if (opportunityId) {
    await logParticipantEvent(opportunityId, 'participant_removed', participantName || 'Participante');
  }
}
