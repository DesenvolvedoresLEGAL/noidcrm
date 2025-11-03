import { supabase } from '@/integrations/supabase/client';

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

export const formatAuditValue = (fieldName: string, value: any): string => {
  if (value === null || value === undefined) {
    return 'Não definido';
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
    return new Date(value).toLocaleDateString('pt-BR');
  }

  return String(value);
};

export const getActionDescription = (entry: AuditLogEntry): string => {
  const actorName = entry.actor?.full_name || 'Usuário';
  const fieldLabel = entry.field_name ? fieldLabels[entry.field_name] || entry.field_name : '';

  switch (entry.action) {
    case 'opportunity_created':
      return `${actorName} criou a oportunidade`;
    
    case 'field_updated':
      const oldValue = formatAuditValue(entry.field_name!, entry.old_value);
      const newValue = formatAuditValue(entry.field_name!, entry.new_value);
      return `${actorName} alterou ${fieldLabel} de "${oldValue}" para "${newValue}"`;
    
    case 'stage_moved':
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
    
    default:
      return `${actorName} realizou uma ação: ${entry.action}`;
  }
};

export async function listOpportunityHistory(opportunityId: string): Promise<AuditLogEntry[]> {
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

  // Fetch actor profiles separately
  const actorIds = [...new Set(data?.map(entry => entry.actor_user_id).filter(Boolean) as string[])];
  
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', actorIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

    return data?.map(entry => ({
      ...entry,
      actor: entry.actor_user_id ? profileMap.get(entry.actor_user_id) : undefined,
    })) as AuditLogEntry[];
  }

  return data as AuditLogEntry[];
}
