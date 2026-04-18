import { supabase } from '@/integrations/supabase/client';
import { Activity } from '../crm/types';
import { addActivityParticipants, updateActivityParticipants } from '../crm/activity-participants';
import { processPendingWorkflows } from '../crm/workflow-rules';

const ACTIVITY_SELECT = `
  *,
  opportunity:opportunities(*),
  account:accounts(*),
  contact:contacts(*)
`;

export interface ActivityListParams {
  search?: string;
  status?: string;
  type?: string;
  assignee_id?: string;
  opportunity_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  owner_user_id?: string;
  owner_user_ids?: string[];
  date_filter?: string;
  status_filter?: 'pending' | 'completed' | 'all';
}

async function enrichOwnerName<T extends { owner_user_id?: string | null }>(activity: T): Promise<T & { owner_name?: string }> {
  if (!activity?.owner_user_id) return activity;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', activity.owner_user_id)
    .maybeSingle();

  return {
    ...activity,
    owner_name: profile?.full_name || 'Sem responsável',
  };
}

async function enrichOwnerNames<T extends { owner_user_id?: string | null }>(activities: T[]): Promise<Array<T & { owner_name?: string }>> {
  const ownerIds = [...new Set(activities.map((activity) => activity.owner_user_id).filter(Boolean))] as string[];
  if (ownerIds.length === 0) return activities;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', ownerIds);

  const ownerMap = new Map((profiles || []).map((profile) => [profile.user_id, profile.full_name]));

  return activities.map((activity) => ({
    ...activity,
    owner_name: activity.owner_user_id ? ownerMap.get(activity.owner_user_id) || 'Sem responsável' : undefined,
  }));
}

export async function listActivities(params: ActivityListParams = {}) {
  const {
    search,
    status,
    type,
    assignee_id,
    opportunity_id,
    start_date,
    end_date,
    page = 1,
    page_size = 50,
    owner_user_id,
    owner_user_ids,
    date_filter,
    status_filter = 'pending',
  } = params;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  let query = supabase
    .from('activities')
    .select(ACTIVITY_SELECT, { count: 'exact' })
    .is('deleted_at', null);

  if (search) {
    const sanitizedSearch = search.replace(/[%*.,()]/g, '');
    query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
  }

  if (status) {
    query = query.eq('status', status);
  } else if (status_filter === 'pending') {
    query = query.eq('status', 'pending');
  } else if (status_filter === 'completed') {
    query = query.in('status', ['completed', 'no_show']);
  }

  if (type) query = query.eq('type', type);
  if (assignee_id) query = query.eq('owner_user_id', assignee_id);
  if (owner_user_id) query = query.eq('owner_user_id', owner_user_id);
  if (owner_user_ids?.length) query = query.in('owner_user_id', owner_user_ids);
  if (opportunity_id) query = query.eq('opportunity_id', opportunity_id);
  if (start_date) query = query.gte('scheduled_date', start_date);
  if (end_date) query = query.lte('scheduled_date', end_date);

  if (date_filter && status_filter === 'pending') {
    switch (date_filter) {
      case 'overdue':
        query = query.lt('scheduled_date', startOfToday);
        break;
      case 'today':
        query = query.gte('scheduled_date', startOfToday).lt('scheduled_date', endOfToday);
        break;
      case 'this_week':
        query = query.gte('scheduled_date', startOfToday).lt('scheduled_date', endOfWeek);
        break;
      case 'this_month':
        query = query.gte('scheduled_date', startOfToday).lte('scheduled_date', endOfMonth);
        break;
      case 'scheduled':
        query = query.gte('scheduled_date', startOfToday);
        break;
    }
  }

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  const { data, error, count } = await query
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const activities = await enrichOwnerNames((data || []) as any[]);
  return {
    activities: activities as Activity[],
    total: count || 0,
  };
}

export async function createActivity(dto: Partial<Activity> & { participant_ids?: string[]; assigned_to?: string }): Promise<Activity> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  if (orgError || !orgId) throw orgError || new Error('Organização não encontrada');

  const insertData = {
    title: dto.title,
    type: dto.type,
    description: dto.description ?? null,
    status: dto.status ?? 'pending',
    scheduled_date: dto.scheduled_date ?? null,
    completed_at: dto.completed_at ?? null,
    duration_minutes: dto.duration_minutes ?? null,
    account_id: dto.account_id ?? null,
    contact_id: dto.contact_id ?? null,
    opportunity_id: dto.opportunity_id ?? null,
    organization_id: orgId,
    owner_user_id: dto.assigned_to || dto.owner_user_id || user.id,
    is_automated: dto.is_automated ?? false,
    ai_generated: dto.ai_generated ?? false,
    sentiment: dto.sentiment ?? null,
    external_link: dto.external_link ?? null,
  };

  const { data, error } = await supabase
    .from('activities')
    .insert(insertData)
    .select(ACTIVITY_SELECT)
    .single();

  if (error) throw error;

  if (dto.participant_ids?.length) {
    try {
      await addActivityParticipants(data.id, dto.participant_ids, orgId);
    } catch (participantError) {
      console.error('Error adding participants:', participantError);
    }
  }

  return (await enrichOwnerName(data as any)) as Activity;
}

export async function updateActivity(id: string, dto: Partial<Activity> & { participant_ids?: string[]; assigned_to?: string }): Promise<Activity> {
  const updateData: Record<string, any> = {};

  if (dto.title !== undefined) updateData.title = dto.title;
  if (dto.type !== undefined) updateData.type = dto.type;
  if (dto.description !== undefined) updateData.description = dto.description;
  if (dto.status !== undefined) updateData.status = dto.status;
  if (dto.scheduled_date !== undefined) updateData.scheduled_date = dto.scheduled_date;
  if (dto.completed_at !== undefined) updateData.completed_at = dto.completed_at;
  if (dto.sentiment !== undefined) updateData.sentiment = dto.sentiment;
  if (dto.duration_minutes !== undefined) updateData.duration_minutes = dto.duration_minutes;
  if ('account_id' in dto) updateData.account_id = dto.account_id || null;
  if ('contact_id' in dto) updateData.contact_id = dto.contact_id || null;
  if ('opportunity_id' in dto) updateData.opportunity_id = dto.opportunity_id || null;
  if (dto.assigned_to) updateData.owner_user_id = dto.assigned_to;
  if (dto.owner_user_id) updateData.owner_user_id = dto.owner_user_id;

  const { data, error } = await supabase
    .from('activities')
    .update(updateData)
    .eq('id', id)
    .select(ACTIVITY_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Atividade não encontrada ou sem permissão para atualizar');

  if (dto.participant_ids !== undefined) {
    try {
      await updateActivityParticipants(data.id, dto.participant_ids, data.organization_id);
    } catch (participantError) {
      console.error('Error updating participants:', participantError);
    }
  }

  return (await enrichOwnerName(data as any)) as Activity;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}

export async function completeActivity(id: string): Promise<Activity> {
  const activity = await updateActivity(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  // Fire-and-forget: don't block the UI on workflow processing.
  // The cron `process-pending-workflows` runs every 5 minutes as fallback,
  // so even if this client-side trigger drops, the workflow still executes.
  if (activity.opportunity_id) {
    void processPendingWorkflows(activity.opportunity_id).catch((error) => {
      console.error('[completeActivity] Background workflow trigger failed:', error);
    });
  }

  return activity;
}

export async function markActivityAsNoShow(id: string): Promise<Activity> {
  return updateActivity(id, {
    status: 'no_show',
    completed_at: new Date().toISOString(),
  });
}

export async function getActivityStats(ownerUserIds?: string[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const withOwnerFilter = (query: any) => {
    if (ownerUserIds?.length) return query.in('owner_user_id', ownerUserIds);
    return query;
  };

  const [overdue, today, thisWeek, thisMonth, scheduled] = await Promise.all([
    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('scheduled_date', startOfToday),
    ),
    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('scheduled_date', startOfToday).lt('scheduled_date', endOfToday),
    ),
    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('scheduled_date', startOfWeek).lt('scheduled_date', endOfToday),
    ),
    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('scheduled_date', startOfMonth),
    ),
    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ),
  ]);

  return {
    overdue: overdue.count || 0,
    today: today.count || 0,
    thisWeek: thisWeek.count || 0,
    thisMonth: thisMonth.count || 0,
    scheduled: scheduled.count || 0,
  };
}
