import { supabase } from '@/integrations/supabase/client';
import { Activity } from '../crm/types';

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
  } = params;

  let query = supabase
    .from('activities')
    .select('*, opportunity:opportunities(*), account:accounts(*), contact:contacts(*)', { count: 'exact' });

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (type) {
    query = query.eq('type', type);
  }
  if (assignee_id) {
    query = query.eq('owner_user_id', assignee_id);
  }
  if (opportunity_id) {
    query = query.eq('opportunity_id', opportunity_id);
  }
  if (start_date) {
    query = query.gte('scheduled_date', start_date);
  }
  if (end_date) {
    query = query.lte('scheduled_date', end_date);
  }

  const { data, error, count } = await query
    .order('scheduled_date', { ascending: true })
    .range((page - 1) * page_size, page * page_size - 1);

  if (error) throw error;

  return {
    activities: data as Activity[],
    total: count || 0,
    page,
    page_size,
  };
}

export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, opportunity:opportunities(*), account:accounts(*), contact:contacts(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Activity | null;
}

export async function createActivity(dto: Partial<Activity>): Promise<Activity> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const { data, error } = await supabase
    .from('activities')
    .insert({
      title: dto.title,
      type: dto.type,
      description: dto.description,
      status: dto.status || 'pending',
      scheduled_date: dto.scheduled_date,
      owner_user_id: user.id,
      opportunity_id: dto.opportunity_id,
      account_id: dto.account_id,
      contact_id: dto.contact_id,
      is_automated: dto.is_automated || false,
      ai_generated: dto.ai_generated || false,
      organization_id: memberData?.organization_id,
    })
    .select('*, opportunity:opportunities(*), account:accounts(*), contact:contacts(*)')
    .single();

  if (error) throw error;
  return data as Activity;
}

export async function updateActivity(id: string, dto: Partial<Activity>): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .update({
      title: dto.title,
      type: dto.type,
      description: dto.description,
      status: dto.status,
      scheduled_date: dto.scheduled_date,
      completed_at: dto.completed_at,
      sentiment: dto.sentiment,
    })
    .eq('id', id)
    .select('*, opportunity:opportunities(*), account:accounts(*), contact:contacts(*)')
    .single();

  if (error) throw error;
  return data as Activity;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function completeActivity(id: string): Promise<Activity> {
  return updateActivity(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

export async function markActivityAsNoShow(id: string): Promise<Activity> {
  return updateActivity(id, {
    status: 'no_show',
    completed_at: new Date().toISOString(),
  });
}

export async function getActivityStats() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [overdue, today, thisWeek, thisMonth, scheduled] = await Promise.all([
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('scheduled_date', startOfToday),
    
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('scheduled_date', startOfToday)
      .lt('scheduled_date', endOfToday),
    
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('scheduled_date', startOfWeek)
      .lt('scheduled_date', endOfToday),
    
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('scheduled_date', startOfMonth),
    
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  return {
    overdue: overdue.count || 0,
    today: today.count || 0,
    thisWeek: thisWeek.count || 0,
    thisMonth: thisMonth.count || 0,
    scheduled: scheduled.count || 0,
  };
}
