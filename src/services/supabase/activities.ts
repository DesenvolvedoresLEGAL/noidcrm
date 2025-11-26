import { supabase } from '@/integrations/supabase/client';
import { Activity } from '../crm/types';
import { addActivityParticipants, updateActivityParticipants } from '../crm/activity-participants';
import { z } from 'zod';

const activitySchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  type: z.string().min(1, 'Tipo é obrigatório'),
  description: z.string().max(2000).optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'no_show']).optional(),
  scheduled_date: z.string().or(z.date()).optional(),
  opportunity_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  is_automated: z.boolean().optional(),
  ai_generated: z.boolean().optional(),
  assigned_to: z.string().uuid().optional(), // Campo do modal que mapeia para owner_user_id
  owner_user_id: z.string().uuid().optional(),
}).passthrough();

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
  owner_user_id?: string; // NOVO: filtro por owner (vendedores)
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
    .select(`
      *, 
      opportunity:opportunities(*), 
      account:accounts(*), 
      contact:contacts(*),
      owner:profiles!activities_owner_user_id_fkey(full_name)
    `, { count: 'exact' });

  if (search) {
    // Sanitize search input to prevent SQL injection
    const sanitizedSearch = search.replace(/[%*.,()]/g, '');
    query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
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

  // NOVO: Filtro por owner (para vendedores verem apenas suas atividades)
  if (params.owner_user_id) {
    query = query.eq('owner_user_id', params.owner_user_id);
  }

  const { data, error, count } = await query
    .order('scheduled_date', { ascending: true })
    .range((page - 1) * page_size, page * page_size - 1);

  if (error) throw error;

  // Mapear owner_name para o objeto
  const activitiesWithOwnerName = (data || []).map((activity: any) => ({
    ...activity,
    owner_name: activity.owner?.full_name || 'Sem responsável',
  }));

  return {
    activities: activitiesWithOwnerName as Activity[],
    total: count || 0,
    page,
    page_size,
  };
}

export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *, 
      opportunity:opportunities(*), 
      account:accounts(*), 
      contact:contacts(*),
      owner:profiles!activities_owner_user_id_fkey(full_name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  
  if (!data) return null;
  
  // Mapear owner_name para o objeto
  const activityWithOwnerName = {
    ...data,
    owner_name: (data as any).owner?.full_name || 'Sem responsável',
  };
  
  return activityWithOwnerName as Activity;
}

export async function createActivity(dto: unknown): Promise<Activity> {
  // Validate input
  const validated = activitySchema.parse(dto);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id using RPC function (same as RLS policies)
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    console.error('Error fetching organization:', orgError);
    throw new Error('Você precisa pertencer a uma organização para criar atividades');
  }

  // Preparar dados para inserção
  const insertData: any = {
    title: validated.title,
    type: validated.type,
    description: validated.description,
    status: validated.status || 'pending',
    scheduled_date: validated.scheduled_date instanceof Date 
      ? validated.scheduled_date.toISOString() 
      : validated.scheduled_date,
    owner_user_id: validated.assigned_to || user.id, // Usar assigned_to se fornecido, senão usar o usuário atual
    opportunity_id: validated.opportunity_id,
    account_id: validated.account_id,
    contact_id: validated.contact_id,
    is_automated: validated.is_automated || false,
    ai_generated: validated.ai_generated || false,
    organization_id: orgId,
  };

  // Adicionar duration_minutes se fornecido
  const activity = dto as any;
  if (activity.duration_minutes !== undefined) {
    insertData.duration_minutes = parseInt(String(activity.duration_minutes));
  }

  // Adicionar external_link se fornecido
  if (activity.external_link) {
    insertData.external_link = activity.external_link;
  }

  const { data, error } = await supabase
    .from('activities')
    .insert([insertData])
    .select(`
      *, 
      opportunity:opportunities(*), 
      account:accounts(*), 
      contact:contacts(*),
      owner:profiles!activities_owner_user_id_fkey(full_name)
    `)
    .single();

  if (error) {
    console.error('Error creating activity:', error);
    throw error;
  }

  // Add participants if provided
  if (activity.participant_ids && activity.participant_ids.length > 0) {
    try {
      await addActivityParticipants(data.id, activity.participant_ids, orgId);
    } catch (participantError) {
      console.error('Error adding participants:', participantError);
      // Não falhar a criação da atividade se os participantes falharem
    }
  }

  // Mapear owner_name para o objeto de retorno
  const activityWithOwnerName = {
    ...data,
    owner_name: (data as any).owner?.full_name || 'Sem responsável',
  };

  return activityWithOwnerName as Activity;
}

export async function updateActivity(id: string, dto: Partial<Activity>): Promise<Activity> {
  // Mapear assigned_to para owner_user_id se fornecido
  const updateData: any = {
    title: dto.title,
    type: dto.type,
    description: dto.description,
    status: dto.status,
    scheduled_date: dto.scheduled_date,
    completed_at: dto.completed_at,
    sentiment: dto.sentiment,
    duration_minutes: dto.duration_minutes,
    account_id: dto.account_id,
    contact_id: dto.contact_id,
    opportunity_id: dto.opportunity_id,
  };

  // Se assigned_to foi fornecido, mapear para owner_user_id
  if ('assigned_to' in dto && dto.assigned_to) {
    updateData.owner_user_id = dto.assigned_to;
  }

  const { data, error } = await supabase
    .from('activities')
    .update(updateData)
    .eq('id', id)
    .select(`
      *, 
      opportunity:opportunities(*), 
      account:accounts(*), 
      contact:contacts(*),
      owner:profiles!activities_owner_user_id_fkey(full_name)
    `)
    .single();

  if (error) throw error;

  // Update participants if provided
  if (dto.participant_ids !== undefined) {
    // Get organization_id from the activity
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (memberData?.organization_id) {
        await updateActivityParticipants(id, dto.participant_ids, memberData.organization_id);
      }
    }
  }

  // Mapear owner_name para o objeto de retorno
  const activityWithOwnerName = {
    ...data,
    owner_name: (data as any).owner?.full_name || 'Sem responsável',
  };

  return activityWithOwnerName as Activity;
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
