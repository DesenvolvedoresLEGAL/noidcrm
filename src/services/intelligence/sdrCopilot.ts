import { supabase } from '@/integrations/supabase/client';

export type SDRCopilotStatus =
  | 'pending' | 'in_review' | 'approved'
  | 'activity_created' | 'promoted_to_crm'
  | 'dismissed' | 'completed';

export type SDRCopilotChannel = 'whatsapp' | 'email' | 'linkedin' | 'call';

export type SDRCopilotNextAction =
  | 'call' | 'whatsapp' | 'email' | 'linkedin'
  | 'create_activity' | 'promote_to_crm'
  | 'reactivate_customer' | 'review_duplicate' | 'discard';

export interface SDRCopilotTask {
  id: string;
  organization_id: string;
  queue_id: string;
  prospect_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  assigned_to: string | null;
  status: SDRCopilotStatus;
  priority_score: number;
  preferred_channel: SDRCopilotChannel | null;
  next_best_action: SDRCopilotNextAction | null;
  reason: string | null;
  commercial_brief: Record<string, unknown>;
  suggested_messages: Record<string, unknown>;
  objections: unknown[];
  cta: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SDRCopilotFilters {
  status?: SDRCopilotStatus | 'all';
  assignedTo?: string | 'all' | 'me' | 'unassigned';
  channel?: SDRCopilotChannel | 'all';
  withPhone?: boolean;
  withBrief?: boolean;
  scoreMin?: number;
  coverageClass?: string | 'all';
  search?: string;
}

export async function listSDRCopilotTasks(filters: SDRCopilotFilters = {}) {
  let q = (supabase as any)
    .from('kairos_sdr_copilot_tasks')
    .select('*')
    .order('priority_score', { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.channel && filters.channel !== 'all') q = q.eq('preferred_channel', filters.channel);
  if (filters.scoreMin != null) q = q.gte('priority_score', filters.scoreMin);

  if (filters.assignedTo === 'unassigned') q = q.is('assigned_to', null);
  else if (filters.assignedTo && filters.assignedTo !== 'all' && filters.assignedTo !== 'me') {
    q = q.eq('assigned_to', filters.assignedTo);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SDRCopilotTask[];
}

export async function createSDRCopilotTask(queueId: string, assignedTo?: string | null) {
  const { data, error } = await supabase.functions.invoke('kairos-create-sdr-copilot-task', {
    body: { queue_id: queueId, assigned_to: assignedTo ?? null },
  });
  if (error) throw error;
  return data as { task_id: string; reused: boolean };
}

export async function generateSDRMessage(
  taskId: string,
  channel: SDRCopilotChannel,
  forceRefresh = false,
) {
  const { data, error } = await supabase.functions.invoke('kairos-generate-sdr-message', {
    body: { task_id: taskId, channel, force_refresh: forceRefresh },
  });
  if (error) throw error;
  return data as { channel: SDRCopilotChannel; message: unknown; cached: boolean };
}

export async function updateSDRCopilotTaskStatus(
  taskId: string,
  status: SDRCopilotStatus,
  patch: Partial<SDRCopilotTask> = {},
) {
  const completedAt =
    status === 'completed' || status === 'dismissed' || status === 'promoted_to_crm'
      ? new Date().toISOString()
      : null;
  const { data, error } = await (supabase as any)
    .from('kairos_sdr_copilot_tasks')
    .update({ status, completed_at: completedAt, ...patch })
    .eq('id', taskId)
    .select('*')
    .single();
  if (error) throw error;
  return data as SDRCopilotTask;
}

export async function logSDRCopilotEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await (supabase as any).from('revenue_events').insert({
    organization_id: organizationId,
    event_type: eventType,
    payload,
  });
}

export const CHANNEL_LABEL: Record<SDRCopilotChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  linkedin: 'LinkedIn',
  call: 'Ligação',
};

export const NEXT_ACTION_LABEL: Record<SDRCopilotNextAction, string> = {
  call: 'Ligar',
  whatsapp: 'WhatsApp',
  email: 'Enviar e-mail',
  linkedin: 'Conectar LinkedIn',
  create_activity: 'Criar atividade',
  promote_to_crm: 'Promover ao CRM',
  reactivate_customer: 'Reativar cliente',
  review_duplicate: 'Revisar duplicidade',
  discard: 'Descartar',
};

export const STATUS_LABEL: Record<SDRCopilotStatus, string> = {
  pending: 'Pendente',
  in_review: 'Em revisão',
  approved: 'Aprovada',
  activity_created: 'Atividade criada',
  promoted_to_crm: 'Promovida ao CRM',
  dismissed: 'Descartada',
  completed: 'Concluída',
};
