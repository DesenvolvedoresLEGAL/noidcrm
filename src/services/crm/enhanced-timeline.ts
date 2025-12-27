import { supabase } from '@/integrations/supabase/client';

export type TimelineEventType = 'activity' | 'note' | 'email' | 'audit' | 'proposal' | 'file' | 'automation';

export interface EnhancedTimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  activity_type: string;
  owner_user_id: string | null;
  opportunity_id: string | null;
  organization_id: string;
  deleted_at: string | null;
  metadata: Record<string, any>;
  owner?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export interface TimelineFilters {
  opportunityId: string;
  limit?: number;
  types?: TimelineEventType[];
}

const LIMIT_OPTIONS = [10, 25, 50, 100, 200, 300] as const;
export type LimitOption = typeof LIMIT_OPTIONS[number];
export { LIMIT_OPTIONS };

export async function getEnhancedTimeline(filters: TimelineFilters): Promise<EnhancedTimelineEvent[]> {
  const { opportunityId, limit = 50, types } = filters;

  // Fetch from unified_timeline view
  let query = supabase
    .from('unified_timeline')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  // Filter by types if specified
  if (types && types.length > 0) {
    query = query.in('type', types);
  }

  const { data: timelineData, error: timelineError } = await query;

  if (timelineError) {
    console.error('Error fetching timeline:', timelineError);
    throw timelineError;
  }

  // Collect all owner_user_ids to fetch profile info
  const ownerIds = [...new Set(
    (timelineData || [])
      .filter(e => e.owner_user_id)
      .map(e => e.owner_user_id)
  )];

  // Fetch owner profiles
  let ownerProfiles: Record<string, { full_name: string; avatar_url: string | null }> = {};
  
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ownerIds);

    if (profiles) {
      ownerProfiles = profiles.reduce((acc, p) => {
        acc[p.id] = { full_name: p.full_name || 'Usuário', avatar_url: p.avatar_url };
        return acc;
      }, {} as Record<string, { full_name: string; avatar_url: string | null }>);
    }
  }

  // Enrich timeline events with owner info
  const enrichedEvents: EnhancedTimelineEvent[] = (timelineData || []).map(event => ({
    id: event.id as string,
    type: event.type as TimelineEventType,
    timestamp: event.timestamp as string,
    title: event.title as string,
    activity_type: event.activity_type as string,
    owner_user_id: event.owner_user_id as string | null,
    opportunity_id: event.opportunity_id as string | null,
    organization_id: event.organization_id as string,
    deleted_at: event.deleted_at as string | null,
    metadata: (typeof event.metadata === 'object' && event.metadata !== null ? event.metadata : {}) as Record<string, any>,
    owner: event.owner_user_id ? ownerProfiles[event.owner_user_id as string] || null : null,
  }));

  return enrichedEvents;
}

// Type labels for filtering UI
export const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  activity: 'Atividades',
  note: 'Notas',
  email: 'E-mails',
  audit: 'Alterações',
  proposal: 'Propostas',
  file: 'Arquivos',
  automation: 'Automações',
};

// Get action label for display
export function getEventActionLabel(type: TimelineEventType, activityType: string, metadata?: Record<string, any>): string {
  switch (type) {
    case 'activity':
      if (metadata?.deleted_at || metadata?.status === 'deleted') return 'Atividade excluída';
      if (metadata?.status === 'completed' || metadata?.completed_at) return 'Atividade concluída';
      if (metadata?.status === 'no_show') return 'No-show';
      return 'Atividade agendada';
    
    case 'note':
      return 'Nota adicionada';
    
    case 'email':
      if (metadata?.opened_at) return 'E-mail aberto';
      if (metadata?.clicked_at) return 'E-mail clicado';
      return 'E-mail enviado';
    
    case 'audit':
      switch (activityType) {
        case 'opportunity_created': return 'Oportunidade criada';
        case 'stage_moved': return 'Estágio alterado';
        case 'field_updated': return 'Campo atualizado';
        case 'status_changed': return 'Status alterado';
        case 'opportunity_deleted': return 'Oportunidade excluída';
        case 'proposal_accepted': return 'Proposta aceita';
        case 'handoff_received': return 'Passagem de bastão';
        default: return activityType.replace(/_/g, ' ');
      }
    
    case 'proposal':
      switch (activityType) {
        case 'accepted': return 'Proposta aceita';
        case 'viewed': return 'Proposta visualizada';
        case 'sent': return 'Proposta enviada';
        case 'draft': return 'Proposta criada';
        default: return 'Proposta';
      }
    
    case 'file':
      return 'Arquivo anexado';
    
    case 'automation':
      return 'Automação executada';
    
    default:
      return activityType;
  }
}

// Activity type labels (for activity events)
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: 'Ligação',
  meeting: 'Reunião',
  email: 'E-mail',
  task: 'Tarefa',
  note: 'Nota',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  visit: 'Visita',
  demo: 'Demonstração',
  proposal: 'Proposta',
  follow_up: 'Follow-up',
  other: 'Outro',
};
