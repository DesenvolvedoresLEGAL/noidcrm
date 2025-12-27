import { supabase } from '@/integrations/supabase/client';

export type TimelineLogType = 'activity' | 'note' | 'email' | 'audit' | 'proposal' | 'file' | 'automation' | 'stakeholder' | 'participant' | 'score' | 'vibe' | 'ai';

export interface TimelineLogParams {
  opportunityId: string;
  type: TimelineLogType;
  activityType: string;
  title: string;
  metadata?: Record<string, any>;
}

/**
 * Centralized function to log timeline events for an opportunity.
 * Automatically fetches organization_id and actor_user_id (current user).
 */
export async function logTimelineEvent(params: TimelineLogParams): Promise<void> {
  const { opportunityId, type, activityType, title, metadata = {} } = params;

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('logTimelineEvent: No authenticated user, skipping log');
      return;
    }

    // Get organization ID
    const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
    if (orgError || !orgId) {
      console.warn('logTimelineEvent: Could not get organization ID', orgError);
      return;
    }

    // Insert into timeline_events
    const { error } = await supabase
      .from('timeline_events')
      .insert({
        opportunity_id: opportunityId,
        organization_id: orgId,
        type,
        activity_type: activityType,
        title,
        actor_user_id: user.id,
        metadata,
        timestamp: new Date().toISOString(),
      });

    if (error) {
      console.error('logTimelineEvent: Failed to insert event', error);
    }
  } catch (err) {
    console.error('logTimelineEvent: Unexpected error', err);
  }
}

/**
 * Log a stakeholder action (champion/decision maker set/removed)
 */
export async function logStakeholderEvent(
  opportunityId: string,
  action: 'champion_set' | 'champion_removed' | 'decision_maker_set' | 'decision_maker_removed',
  contactName?: string,
  contactCargo?: string
): Promise<void> {
  const titles: Record<string, string> = {
    champion_set: `Champion definido: ${contactName || 'Contato'}`,
    champion_removed: 'Champion removido',
    decision_maker_set: `Decision Maker definido: ${contactName || 'Contato'}`,
    decision_maker_removed: 'Decision Maker removido',
  };

  await logTimelineEvent({
    opportunityId,
    type: 'stakeholder',
    activityType: action,
    title: titles[action],
    metadata: {
      contact_name: contactName,
      contact_cargo: contactCargo,
    },
  });
}

/**
 * Log a participant action (added/removed/updated)
 */
export async function logParticipantEvent(
  opportunityId: string,
  action: 'participant_added' | 'participant_removed' | 'participant_updated',
  participantName: string,
  role?: string,
  sharePercentage?: number
): Promise<void> {
  const roleLabels: Record<string, string> = {
    owner: 'Proprietário',
    collaborator: 'Colaborador',
    observer: 'Observador',
  };

  const titles: Record<string, string> = {
    participant_added: `Participante adicionado: ${participantName} (${roleLabels[role || ''] || role || 'Colaborador'})`,
    participant_removed: `Participante removido: ${participantName}`,
    participant_updated: `Participante atualizado: ${participantName}`,
  };

  await logTimelineEvent({
    opportunityId,
    type: 'participant',
    activityType: action,
    title: titles[action],
    metadata: {
      participant_name: participantName,
      role,
      role_label: roleLabels[role || ''] || role,
      share_percentage: sharePercentage,
    },
  });
}

/**
 * Log a note action (created/updated/deleted)
 */
export async function logNoteEvent(
  opportunityId: string,
  action: 'note_created' | 'note_updated' | 'note_deleted',
  noteContent?: string
): Promise<void> {
  const titles: Record<string, string> = {
    note_created: 'Nota adicionada',
    note_updated: 'Nota editada',
    note_deleted: 'Nota excluída',
  };

  // Truncate content for display
  const truncatedContent = noteContent && noteContent.length > 100 
    ? noteContent.substring(0, 100) + '...' 
    : noteContent;

  await logTimelineEvent({
    opportunityId,
    type: 'note',
    activityType: action,
    title: titles[action],
    metadata: {
      content_preview: truncatedContent,
    },
  });
}

/**
 * Log a file action (uploaded/deleted)
 */
export async function logFileEvent(
  opportunityId: string,
  action: 'file_uploaded' | 'file_deleted',
  fileName: string,
  fileSize?: number,
  fileType?: string
): Promise<void> {
  const titles: Record<string, string> = {
    file_uploaded: `Arquivo enviado: ${fileName}`,
    file_deleted: `Arquivo excluído: ${fileName}`,
  };

  await logTimelineEvent({
    opportunityId,
    type: 'file',
    activityType: action,
    title: titles[action],
    metadata: {
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
    },
  });
}

/**
 * Log an activity action (created/completed/no-show/deleted)
 */
export async function logActivityEvent(
  opportunityId: string,
  action: 'activity_created' | 'activity_completed' | 'activity_no_show' | 'activity_deleted' | 'activity_updated',
  activityTitle: string,
  activityType?: string
): Promise<void> {
  const titles: Record<string, string> = {
    activity_created: `Atividade criada: ${activityTitle}`,
    activity_completed: `Atividade concluída: ${activityTitle}`,
    activity_no_show: `No-show registrado: ${activityTitle}`,
    activity_deleted: `Atividade excluída: ${activityTitle}`,
    activity_updated: `Atividade atualizada: ${activityTitle}`,
  };

  await logTimelineEvent({
    opportunityId,
    type: 'activity',
    activityType: action,
    title: titles[action],
    metadata: {
      activity_title: activityTitle,
      activity_type: activityType,
    },
  });
}

/**
 * Log a proposal action (duplicated/deleted/status changed)
 */
export async function logProposalEvent(
  opportunityId: string,
  action: 'proposal_duplicated' | 'proposal_deleted' | 'proposal_status_changed',
  proposalTitle: string,
  newStatus?: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    sent: 'Enviada',
    viewed: 'Visualizada',
    accepted: 'Aceita',
    rejected: 'Recusada',
    expired: 'Expirada',
  };

  const titles: Record<string, string> = {
    proposal_duplicated: `Proposta duplicada: ${proposalTitle}`,
    proposal_deleted: `Proposta excluída: ${proposalTitle}`,
    proposal_status_changed: `Proposta ${statusLabels[newStatus || ''] || newStatus}: ${proposalTitle}`,
  };

  await logTimelineEvent({
    opportunityId,
    type: 'proposal',
    activityType: action,
    title: titles[action],
    metadata: {
      proposal_title: proposalTitle,
      new_status: newStatus,
      status_label: statusLabels[newStatus || ''],
    },
  });
}

/**
 * Log a vibe alert action (resolved/dismissed)
 */
export async function logVibeAlertEvent(
  opportunityId: string,
  action: 'vibe_resolved' | 'vibe_dismissed',
  alertTitle: string,
  alertType?: string
): Promise<void> {
  const titles: Record<string, string> = {
    vibe_resolved: `Alerta resolvido: ${alertTitle}`,
    vibe_dismissed: `Alerta dispensado: ${alertTitle}`,
  };

  await logTimelineEvent({
    opportunityId,
    type: 'vibe',
    activityType: action,
    title: titles[action],
    metadata: {
      alert_title: alertTitle,
      alert_type: alertType,
    },
  });
}
