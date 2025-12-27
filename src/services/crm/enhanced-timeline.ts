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

  // Collect IDs that need resolution from audit metadata
  const userIdsToResolve = new Set<string>();
  const contactIdsToResolve = new Set<string>();
  const accountIdsToResolve = new Set<string>();
  const stageIdsToResolve = new Set<string>();

  for (const event of timelineData || []) {
    if (event.type === 'audit' && event.metadata) {
      const metadata = typeof event.metadata === 'object' ? event.metadata as Record<string, any> : {};
      const fieldName = metadata.field_name;
      
      // Add IDs based on field type
      if (fieldName === 'owner_user_id') {
        if (metadata.old_value && isValidUUID(metadata.old_value)) userIdsToResolve.add(metadata.old_value);
        if (metadata.new_value && isValidUUID(metadata.new_value)) userIdsToResolve.add(metadata.new_value);
      } else if (fieldName === 'contact_id') {
        if (metadata.old_value && isValidUUID(metadata.old_value)) contactIdsToResolve.add(metadata.old_value);
        if (metadata.new_value && isValidUUID(metadata.new_value)) contactIdsToResolve.add(metadata.new_value);
      } else if (fieldName === 'account_id') {
        if (metadata.old_value && isValidUUID(metadata.old_value)) accountIdsToResolve.add(metadata.old_value);
        if (metadata.new_value && isValidUUID(metadata.new_value)) accountIdsToResolve.add(metadata.new_value);
      } else if (fieldName === 'stage_id') {
        if (metadata.old_value && isValidUUID(metadata.old_value)) stageIdsToResolve.add(metadata.old_value);
        if (metadata.new_value && isValidUUID(metadata.new_value)) stageIdsToResolve.add(metadata.new_value);
      }
    }
  }

  // Add owner IDs to the resolution set
  ownerIds.forEach(id => userIdsToResolve.add(id as string));

  // Batch fetch all entity names in parallel
  // Note: user IDs can be in 'profiles' (id) or 'sellers' (user_id)
  const [profilesResult, sellersResult, contactsResult, accountsResult, stagesResult] = await Promise.all([
    userIdsToResolve.size > 0 
      ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', [...userIdsToResolve])
      : Promise.resolve({ data: [] }),
    userIdsToResolve.size > 0 
      ? supabase.from('sellers').select('user_id, name, avatar_url').in('user_id', [...userIdsToResolve])
      : Promise.resolve({ data: [] }),
    contactIdsToResolve.size > 0 
      ? supabase.from('contacts').select('id, nome').in('id', [...contactIdsToResolve])
      : Promise.resolve({ data: [] }),
    accountIdsToResolve.size > 0 
      ? supabase.from('accounts').select('id, nome_fantasia, razao_social').in('id', [...accountIdsToResolve])
      : Promise.resolve({ data: [] }),
    stageIdsToResolve.size > 0 
      ? supabase.from('stages').select('id, name').in('id', [...stageIdsToResolve])
      : Promise.resolve({ data: [] }),
  ]);

  // Build lookup maps - first from profiles, then override/add from sellers
  const userMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
  
  // Add from profiles
  (profilesResult.data || []).forEach(p => {
    userMap[p.id] = { full_name: p.full_name || 'Usuário', avatar_url: p.avatar_url };
  });
  
  // Add/override from sellers (using user_id as key)
  (sellersResult.data || []).forEach(s => {
    if (s.user_id) {
      userMap[s.user_id] = { full_name: s.name || 'Usuário', avatar_url: s.avatar_url };
    }
  });

  const contactMap: Record<string, string> = {};
  (contactsResult.data || []).forEach(c => {
    contactMap[c.id] = c.nome || 'Contato';
  });

  const accountMap: Record<string, string> = {};
  (accountsResult.data || []).forEach(a => {
    accountMap[a.id] = a.nome_fantasia || a.razao_social || 'Conta';
  });

  const stageMap: Record<string, string> = {};
  (stagesResult.data || []).forEach(s => {
    stageMap[s.id] = s.name || 'Estágio';
  });

  // Enrich timeline events with owner info and resolved metadata labels
  const enrichedEvents: EnhancedTimelineEvent[] = (timelineData || []).map(event => {
    const metadata = (typeof event.metadata === 'object' && event.metadata !== null ? event.metadata : {}) as Record<string, any>;
    
    // Resolve metadata values if this is an audit event
    if (event.type === 'audit' && metadata.field_name) {
      const fieldName = metadata.field_name;
      
      if (fieldName === 'owner_user_id') {
        if (metadata.old_value && userMap[metadata.old_value]) {
          metadata.old_value_label = userMap[metadata.old_value].full_name;
        }
        if (metadata.new_value && userMap[metadata.new_value]) {
          metadata.new_value_label = userMap[metadata.new_value].full_name;
        }
      } else if (fieldName === 'contact_id') {
        if (metadata.old_value && contactMap[metadata.old_value]) {
          metadata.old_value_label = contactMap[metadata.old_value];
        }
        if (metadata.new_value && contactMap[metadata.new_value]) {
          metadata.new_value_label = contactMap[metadata.new_value];
        }
      } else if (fieldName === 'account_id') {
        if (metadata.old_value && accountMap[metadata.old_value]) {
          metadata.old_value_label = accountMap[metadata.old_value];
        }
        if (metadata.new_value && accountMap[metadata.new_value]) {
          metadata.new_value_label = accountMap[metadata.new_value];
        }
      } else if (fieldName === 'stage_id') {
        if (metadata.old_value && stageMap[metadata.old_value]) {
          metadata.old_value_label = stageMap[metadata.old_value];
        }
        if (metadata.new_value && stageMap[metadata.new_value]) {
          metadata.new_value_label = stageMap[metadata.new_value];
        }
      }
    }

    return {
      id: event.id as string,
      type: event.type as TimelineEventType,
      timestamp: event.timestamp as string,
      title: event.title as string,
      activity_type: event.activity_type as string,
      owner_user_id: event.owner_user_id as string | null,
      opportunity_id: event.opportunity_id as string | null,
      organization_id: event.organization_id as string,
      deleted_at: event.deleted_at as string | null,
      metadata,
      owner: event.owner_user_id ? userMap[event.owner_user_id as string] || null : null,
    };
  });

  return enrichedEvents;
}

// Helper to check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
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
