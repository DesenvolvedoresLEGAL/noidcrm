import { supabase } from '@/integrations/supabase/client';

export type TimelineEventType = 'activity' | 'note' | 'email' | 'audit' | 'proposal' | 'file' | 'automation' | 'score' | 'vibe' | 'ai' | 'stakeholder' | 'participant' | 'agent_approval';

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
  // New: actor info for "who did this"
  actor?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  // Proposal acceptance details
  proposal_acceptance?: {
    acceptor_name: string | null;
    acceptor_document_masked: string | null;
    acceptor_position: string | null;
    accepted_at: string | null;
    acceptance_proof_url: string | null;
  } | null;
  // Win/loss record details
  win_loss?: {
    win_reason: string | null;
    key_differentiator: string | null;
    customer_feedback: string | null;
    recorded_by_customer: boolean | null;
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

// Helper to check if a string is a valid UUID
function isValidUUID(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Extract UUID from a value that might be a string or an object with an id
function extractUUID(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string' && isValidUUID(val)) return val;
  if (typeof val === 'object' && val !== null && 'id' in val) {
    const id = (val as Record<string, unknown>).id;
    if (typeof id === 'string' && isValidUUID(id)) return id;
  }
  return null;
}

// Field labels for human-readable display
const FIELD_LABELS: Record<string, string> = {
  stage_id: 'Estágio',
  status: 'Status',
  value: 'Valor',
  expected_close_date: 'Previsão de fechamento',
  close_date_prevista: 'Previsão de fechamento',
  owner_user_id: 'Responsável',
  contact_id: 'Contato',
  account_id: 'Conta',
  temperature: 'Temperatura',
  probability: 'Probabilidade',
  prob: 'Probabilidade',
  valor_previsto: 'Valor previsto',
  qualified_by: 'Qualificado por',
  pipeline_id: 'Pipeline',
  opportunity_score: 'Score do Deal',
  win_probability_ai: 'Win Probability (IA)',
  lead_score: 'Lead Score',
  fit_score: 'Fit Score',
  intent_score: 'Intent Score',
  nrhs_tier: 'NRHS - Categoria',
  nrhs_score: 'NRHS - Score',
  nrhs_issues_count: 'Lacunas Identificadas',
  title: 'Título',
  description: 'Descrição',
  lost_reason_id: 'Motivo de perda',
  win_reason_id: 'Motivo de ganho',
};

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

  // Collect all IDs that need resolution
  const userIdsToResolve = new Set<string>();
  const contactIdsToResolve = new Set<string>();
  const accountIdsToResolve = new Set<string>();
  const stageIdsToResolve = new Set<string>();
  const pipelineIdsToResolve = new Set<string>();
  const proposalIdsToResolve = new Set<string>();

  for (const event of timelineData || []) {
    // Collect owner_user_id
    if (event.owner_user_id && isValidUUID(event.owner_user_id)) {
      userIdsToResolve.add(event.owner_user_id);
    }

    // Collect proposal IDs for acceptance details
    if (event.type === 'proposal' && event.activity_type === 'accepted') {
      proposalIdsToResolve.add(event.id);
    }

    if (event.type === 'audit' && event.metadata) {
      const metadata = typeof event.metadata === 'object' ? event.metadata as Record<string, any> : {};
      const fieldName = metadata.field_name;
      
      // Always extract UUIDs from old_value and new_value
      const oldUUID = extractUUID(metadata.old_value);
      const newUUID = extractUUID(metadata.new_value);
      
      // Categorize based on field type
      if (fieldName?.includes('user_id') || fieldName === 'qualified_by') {
        if (oldUUID) userIdsToResolve.add(oldUUID);
        if (newUUID) userIdsToResolve.add(newUUID);
      } else if (fieldName?.includes('contact')) {
        if (oldUUID) contactIdsToResolve.add(oldUUID);
        if (newUUID) contactIdsToResolve.add(newUUID);
      } else if (fieldName?.includes('account')) {
        if (oldUUID) accountIdsToResolve.add(oldUUID);
        if (newUUID) accountIdsToResolve.add(newUUID);
      } else if (fieldName?.includes('stage')) {
        if (oldUUID) stageIdsToResolve.add(oldUUID);
        if (newUUID) stageIdsToResolve.add(newUUID);
      } else if (fieldName?.includes('pipeline')) {
        if (oldUUID) pipelineIdsToResolve.add(oldUUID);
        if (newUUID) pipelineIdsToResolve.add(newUUID);
      } else {
        // For unknown fields ending with _id, try to resolve as user first
        if (fieldName?.endsWith('_id')) {
          if (oldUUID) userIdsToResolve.add(oldUUID);
          if (newUUID) userIdsToResolve.add(newUUID);
        }
      }
    }
  }

  // Batch fetch all entity names in parallel
  const [
    profilesResult, 
    sellersResult, 
    contactsResult, 
    accountsResult, 
    stagesResult, 
    pipelinesResult,
    proposalsResult,
    winLossResult
  ] = await Promise.all([
    userIdsToResolve.size > 0
      ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', [...userIdsToResolve])
      : Promise.resolve({ data: [] }),
    userIdsToResolve.size > 0
      ? supabase.from('sellers').select('user_id, name').in('user_id', [...userIdsToResolve])
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
    pipelineIdsToResolve.size > 0
      ? supabase.from('pipelines').select('id, name').in('id', [...pipelineIdsToResolve])
      : Promise.resolve({ data: [] }),
    proposalIdsToResolve.size > 0
      ? supabase.from('proposals').select('id, acceptor_name, acceptor_document_masked, acceptor_position, accepted_at, acceptance_proof_url').in('id', [...proposalIdsToResolve])
      : Promise.resolve({ data: [] }),
    // Get win/loss records for this opportunity
    supabase.from('win_loss_records').select('opportunity_id, win_reason:win_reasons(name), key_differentiator, customer_feedback, recorded_by_customer').eq('opportunity_id', opportunityId).maybeSingle()
  ]);

  // Build lookup maps
  const userMap: Record<string, { full_name: string; avatar_url: string | null }> = {};

  // Add from profiles first
  (profilesResult.data || []).forEach((p) => {
    userMap[p.id] = { full_name: p.full_name || 'Usuário', avatar_url: p.avatar_url };
  });

  // Add/override from sellers (prioritize seller names)
  (sellersResult.data || []).forEach((s) => {
    if (s.user_id && s.name) {
      userMap[s.user_id] = { full_name: s.name, avatar_url: userMap[s.user_id]?.avatar_url || null };
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

  const pipelineMap: Record<string, string> = {};
  (pipelinesResult.data || []).forEach(p => {
    pipelineMap[p.id] = p.name || 'Pipeline';
  });

  // Proposal acceptance details map
  const proposalMap: Record<string, any> = {};
  (proposalsResult.data || []).forEach(p => {
    proposalMap[p.id] = {
      acceptor_name: p.acceptor_name,
      acceptor_document_masked: p.acceptor_document_masked,
      acceptor_position: p.acceptor_position,
      accepted_at: p.accepted_at,
      acceptance_proof_url: p.acceptance_proof_url,
    };
  });

  // Win/loss record
  const winLossData = winLossResult.data as any;

  // Helper to resolve a UUID to a label
  const resolveUUID = (uuid: string | null | undefined, fieldName: string): string | null => {
    if (!uuid || !isValidUUID(uuid)) return null;
    
    // Try all maps based on field name
    if (fieldName?.includes('user_id') || fieldName === 'qualified_by' || fieldName === 'owner_user_id') {
      return userMap[uuid]?.full_name || 'Usuário removido';
    }
    if (fieldName?.includes('contact')) {
      return contactMap[uuid] || 'Contato removido';
    }
    if (fieldName?.includes('account')) {
      return accountMap[uuid] || 'Conta removida';
    }
    if (fieldName?.includes('stage')) {
      return stageMap[uuid] || 'Estágio removido';
    }
    if (fieldName?.includes('pipeline')) {
      return pipelineMap[uuid] || 'Pipeline removido';
    }
    
    // Generic resolution - try all maps
    if (userMap[uuid]) return userMap[uuid].full_name;
    if (contactMap[uuid]) return contactMap[uuid];
    if (accountMap[uuid]) return accountMap[uuid];
    if (stageMap[uuid]) return stageMap[uuid];
    if (pipelineMap[uuid]) return pipelineMap[uuid];
    
    // If it's a UUID but we couldn't resolve it, return a generic label
    return 'Registro removido';
  };

  // Format a value for display (handles UUIDs, numbers, dates, etc.)
  const formatValue = (val: unknown, fieldName: string): string => {
    if (val === null || val === undefined) return '-';
    
    // Check if it's a UUID
    const uuid = extractUUID(val);
    if (uuid) {
      const resolved = resolveUUID(uuid, fieldName);
      return resolved || 'Registro removido';
    }
    
    // Handle dates - use UTC components to avoid timezone shift
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      try {
        // Parse date string and extract components to avoid timezone issues
        // If format is YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss, extract year/month/day directly
        const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, year, month, day] = match;
          return `${day}/${month}/${year}`;
        }
        // Fallback to date parsing with UTC
        const date = new Date(val);
        return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
      } catch {
        return val;
      }
    }
    
    // Handle currency fields
    if (fieldName?.includes('valor') || fieldName?.includes('value')) {
      const num = Number(val);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
      }
    }
    
    // Handle probability
    if (fieldName?.includes('prob') || fieldName?.includes('probability')) {
      const num = Number(val);
      if (!isNaN(num)) {
        return `${num}%`;
      }
    }
    
    // Handle score fields
    if (fieldName?.includes('score')) {
      const num = Number(val);
      if (!isNaN(num)) {
        return String(num);
      }
    }
    
    // Handle objects
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    
    return String(val);
  };

  // Enrich timeline events
  const enrichedEvents: EnhancedTimelineEvent[] = (timelineData || []).map(event => {
    const metadata = (typeof event.metadata === 'object' && event.metadata !== null ? { ...event.metadata } : {}) as Record<string, any>;
    
    // Resolve actor/owner info
    const actorInfo = event.owner_user_id && userMap[event.owner_user_id as string] 
      ? userMap[event.owner_user_id as string] 
      : null;

    // Resolve metadata values for audit events
    if (event.type === 'audit' && metadata.field_name) {
      const fieldName = metadata.field_name;
      
      // Get human-readable field label
      metadata.field_label = FIELD_LABELS[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      // Format old and new values
      const oldVal = metadata.old_value;
      const newVal = metadata.new_value;
      
      metadata.old_value_label = formatValue(oldVal, fieldName);
      metadata.new_value_label = formatValue(newVal, fieldName);
    }

    // Proposal acceptance details
    let proposalAcceptance = null;
    if (event.type === 'proposal' && event.activity_type === 'accepted' && proposalMap[event.id]) {
      proposalAcceptance = proposalMap[event.id];
    }

    // Win/loss details for proposal accepted events
    let winLoss = null;
    if ((event.type === 'proposal' && event.activity_type === 'accepted') || 
        (event.type === 'audit' && event.activity_type === 'proposal_accepted')) {
      if (winLossData) {
        winLoss = {
          win_reason: (winLossData.win_reason as any)?.name || null,
          key_differentiator: winLossData.key_differentiator,
          customer_feedback: winLossData.customer_feedback,
          recorded_by_customer: winLossData.recorded_by_customer,
        };
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
      owner: actorInfo,
      actor: actorInfo,
      proposal_acceptance: proposalAcceptance,
      win_loss: winLoss,
    };
  });

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
  score: 'Scores',
  vibe: 'Vibe Alerts',
  ai: 'Inteligência IA',
  stakeholder: 'Stakeholders',
  participant: 'Participantes',
  agent_approval: 'Aprovações IA',
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
        case 'proposal_declined': return 'Proposta recusada';
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
    
    case 'score':
      switch (activityType) {
        case 'score_updated': return 'Score atualizado';
        case 'lead_score_updated': return 'Lead Score atualizado';
        case 'opportunity_score_updated': return 'Score do Deal atualizado';
        case 'nrhs_updated': return 'NRHS atualizado';
        case 'win_probability_updated': return 'Win Probability (IA) atualizada';
        default: return 'Score alterado';
      }
    
    case 'vibe':
      switch (activityType) {
        case 'vibe_alert_created': return 'Alerta de vibe criado';
        case 'vibe_alert_acknowledged': return 'Alerta reconhecido';
        case 'vibe_alert_dismissed': return 'Alerta dispensado';
        default: return 'Alerta de vibe';
      }
    
    case 'ai':
      switch (activityType) {
        case 'ai_score_generated': return 'Inteligência IA gerada';
        default: return 'Análise IA';
      }
    
    case 'stakeholder':
      switch (activityType) {
        case 'champion_set': return 'Champion definido';
        case 'champion_removed': return 'Champion removido';
        case 'decision_maker_set': return 'Decision Maker definido';
        case 'decision_maker_removed': return 'Decision Maker removido';
        default: return 'Stakeholder atualizado';
      }
    
    case 'participant':
      switch (activityType) {
        case 'participant_added': return 'Participante adicionado';
        case 'participant_removed': return 'Participante removido';
        case 'participant_updated': return 'Participante atualizado';
        default: return 'Participante';
      }
    
    case 'agent_approval':
      switch (activityType) {
        case 'pending': return 'Aprovação pendente do agente';
        case 'approved': return 'Aprovação concedida';
        case 'rejected': return 'Aprovação rejeitada';
        default: return 'Aprovação do agente';
      }
    
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
