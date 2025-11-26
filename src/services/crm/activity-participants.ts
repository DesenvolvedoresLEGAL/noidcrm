import { supabase } from '@/integrations/supabase/client';

export interface ActivityParticipant {
  id: string;
  activity_id: string;
  user_id: string;
  role: 'owner' | 'participant' | 'optional';
  is_confirmed: boolean;
  organization_id: string;
  created_at: string;
}

export async function addActivityParticipants(
  activityId: string,
  userIds: string[],
  organizationId: string
): Promise<void> {
  const participants = userIds.map(userId => ({
    activity_id: activityId,
    user_id: userId,
    role: 'participant' as const,
    organization_id: organizationId,
    is_confirmed: false,
  }));

  const { error } = await supabase
    .from('activity_participants')
    .insert(participants);

  if (error) throw error;
}

export async function getActivityParticipants(
  activityId: string
): Promise<ActivityParticipant[]> {
  const { data, error } = await supabase
    .from('activity_participants')
    .select('*')
    .eq('activity_id', activityId);

  if (error) throw error;
  return (data || []) as ActivityParticipant[];
}

export async function removeActivityParticipant(
  participantId: string
): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .delete()
    .eq('id', participantId);

  if (error) throw error;
}

export async function updateActivityParticipants(
  activityId: string,
  userIds: string[],
  organizationId: string
): Promise<void> {
  // Remove existing participants
  await supabase
    .from('activity_participants')
    .delete()
    .eq('activity_id', activityId);

  // Add new participants
  if (userIds.length > 0) {
    await addActivityParticipants(activityId, userIds, organizationId);
  }
}
