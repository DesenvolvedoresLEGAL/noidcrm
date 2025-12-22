import { supabase } from '@/integrations/supabase/client';
import { formatDateBR } from '@/lib/dateUtils';

export interface AuditLogEntry {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  field_name: string | null;
  old_value: any;
  new_value: any;
  metadata: any;
  created_at: string;
  actor?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface EntityNameMaps {
  contacts: Map<string, string>;
  accounts: Map<string, string>;
  users: Map<string, string>;
  stages: Map<string, string>;
}

export const fieldLabels: Record<string, string> = {
  title: 'Título',
  valor_previsto: 'Valor Previsto',
  prob: 'Probabilidade',
  stage_id: 'Estágio',
  status: 'Status',
  temperature: 'Temperatura',
  produto: 'Produto',
  close_date_prevista: 'Data de Fechamento Prevista',
  owner_user_id: 'Responsável',
  account_id: 'Empresa',
  contact_id: 'Contato',
  origem: 'Origem',
  fonte: 'Fonte',
};

export const formatAuditValue = (
  fieldName: string, 
  value: any, 
  nameMaps?: EntityNameMaps
): string => {
  if (value === null || value === undefined) {
    return 'Não definido';
  }

  // Resolve UUIDs to names when available
  if (nameMaps && typeof value === 'string') {
    if (fieldName === 'contact_id' && nameMaps.contacts.has(value)) {
      return nameMaps.contacts.get(value)!;
    }
    if (fieldName === 'account_id' && nameMaps.accounts.has(value)) {
      return nameMaps.accounts.get(value)!;
    }
    if (fieldName === 'owner_user_id' && nameMaps.users.has(value)) {
      return nameMaps.users.get(value)!;
    }
    if (fieldName === 'stage_id' && nameMaps.stages.has(value)) {
      return nameMaps.stages.get(value)!;
    }
  }

  // Handle string values wrapped in quotes (from jsonb)
  if (typeof value === 'string') {
    return value;
  }

  // Handle numeric values
  if (fieldName === 'valor_previsto') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value));
  }

  if (fieldName === 'prob') {
    return `${value}%`;
  }

  if (fieldName === 'close_date_prevista') {
    return formatDateBR(value);
  }

  return String(value);
};

export const getActionDescription = (entry: AuditLogEntry, nameMaps?: EntityNameMaps): string => {
  const actorName = entry.actor?.full_name || 'Usuário';
  const fieldLabel = entry.field_name ? fieldLabels[entry.field_name] || entry.field_name : '';

  switch (entry.action) {
    case 'opportunity_created':
      return `${actorName} criou a oportunidade`;
    
    case 'field_updated':
      const oldValue = formatAuditValue(entry.field_name!, entry.old_value, nameMaps);
      const newValue = formatAuditValue(entry.field_name!, entry.new_value, nameMaps);
      return `${actorName} alterou ${fieldLabel} de "${oldValue}" para "${newValue}"`;
    
    case 'stage_moved':
      const oldStage = nameMaps?.stages.get(entry.old_value) || entry.old_value;
      const newStage = nameMaps?.stages.get(entry.new_value) || entry.new_value;
      if (oldStage && newStage && oldStage !== entry.old_value) {
        return `${actorName} moveu de "${oldStage}" para "${newStage}"`;
      }
      return `${actorName} moveu a oportunidade de estágio`;
    
    case 'status_changed':
      const statusMap: Record<string, string> = {
        new: 'Novo',
        won: 'Ganho',
        lost: 'Perdido',
      };
      const oldStatus = statusMap[entry.old_value] || entry.old_value;
      const newStatus = statusMap[entry.new_value] || entry.new_value;
      return `${actorName} alterou o status de "${oldStatus}" para "${newStatus}"`;
    
    case 'opportunity_deleted':
      return `${actorName} excluiu a oportunidade`;
    
    case 'proposal_accepted':
      const clientName = entry.metadata?.acceptor_name || 'Cliente';
      const clientDoc = entry.metadata?.acceptor_document ? ` (${entry.metadata.acceptor_document})` : '';
      const proposalTitle = entry.metadata?.proposal_title || entry.metadata?.proposal_number || 'Proposta';
      return `Proposta "${proposalTitle}" aceita por ${clientName}${clientDoc}`;
    
    case 'handoff_received':
      const sourcePipeline = entry.metadata?.source_pipeline || 'pipeline anterior';
      return `Recebido via passagem de bastão do ${sourcePipeline}`;
    
    default:
      return `${actorName} realizou uma ação: ${entry.action}`;
  }
};

export interface OpportunityHistoryResult {
  entries: AuditLogEntry[];
  nameMaps: EntityNameMaps;
}

export async function listOpportunityHistory(opportunityId: string): Promise<OpportunityHistoryResult> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_type', 'opportunity')
    .eq('entity_id', opportunityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching audit log:', error);
    throw error;
  }

  const entries = data || [];
  
  // Initialize name maps
  const nameMaps: EntityNameMaps = {
    contacts: new Map(),
    accounts: new Map(),
    users: new Map(),
    stages: new Map(),
  };

  if (entries.length === 0) {
    return { entries: [], nameMaps };
  }

  // Extract unique UUIDs from each field type
  const contactIds = new Set<string>();
  const accountIds = new Set<string>();
  const userIds = new Set<string>();
  const stageIds = new Set<string>();

  for (const entry of entries) {
    // Collect actor user IDs
    if (entry.actor_user_id) {
      userIds.add(entry.actor_user_id);
    }

    // Collect IDs from field changes
    if (entry.field_name === 'contact_id') {
      if (entry.old_value) contactIds.add(String(entry.old_value));
      if (entry.new_value) contactIds.add(String(entry.new_value));
    }
    if (entry.field_name === 'account_id') {
      if (entry.old_value) accountIds.add(String(entry.old_value));
      if (entry.new_value) accountIds.add(String(entry.new_value));
    }
    if (entry.field_name === 'owner_user_id') {
      if (entry.old_value) userIds.add(String(entry.old_value));
      if (entry.new_value) userIds.add(String(entry.new_value));
    }
    if (entry.field_name === 'stage_id' || entry.action === 'stage_moved') {
      if (entry.old_value) stageIds.add(String(entry.old_value));
      if (entry.new_value) stageIds.add(String(entry.new_value));
    }
  }

  // Fetch all related data in parallel
  const [contactsResult, accountsResult, profilesResult, stagesResult] = await Promise.all([
    contactIds.size > 0
      ? supabase.from('contacts').select('id, nome').in('id', Array.from(contactIds))
      : Promise.resolve({ data: [] }),
    accountIds.size > 0
      ? supabase.from('accounts').select('id, razao_social, nome_fantasia').in('id', Array.from(accountIds))
      : Promise.resolve({ data: [] }),
    userIds.size > 0
      ? supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', Array.from(userIds))
      : Promise.resolve({ data: [] }),
    stageIds.size > 0
      ? supabase.from('stages').select('id, name').in('id', Array.from(stageIds))
      : Promise.resolve({ data: [] }),
  ]);

  // Build contact map
  if (contactsResult.data) {
    for (const contact of contactsResult.data) {
      nameMaps.contacts.set(contact.id, contact.nome || 'Contato sem nome');
    }
  }

  // Build account map
  if (accountsResult.data) {
    for (const account of accountsResult.data) {
      nameMaps.accounts.set(account.id, account.nome_fantasia || account.razao_social || 'Empresa sem nome');
    }
  }

  // Build user map
  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
  if (profilesResult.data) {
    for (const profile of profilesResult.data) {
      nameMaps.users.set(profile.user_id, profile.full_name || 'Usuário');
      profileMap.set(profile.user_id, profile);
    }
  }

  // Build stage map
  if (stagesResult.data) {
    for (const stage of stagesResult.data) {
      nameMaps.stages.set(stage.id, stage.name);
    }
  }

  // Enrich entries with actor data
  const enrichedEntries = entries.map(entry => ({
    ...entry,
    actor: entry.actor_user_id ? profileMap.get(entry.actor_user_id) : undefined,
  })) as AuditLogEntry[];

  return { entries: enrichedEntries, nameMaps };
}

export async function listAuditLogByTraceId(traceId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('trace_id', traceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching audit log by trace:', error);
    throw error;
  }

  return (data || []) as AuditLogEntry[];
}
