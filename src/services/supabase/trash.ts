import { supabase } from '@/integrations/supabase/client';

export interface EntitySnapshot {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  snapshot_data: Record<string, any>;
  snapshot_reason: string;
  related_entities: Record<string, any> | null;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
}

export interface DeletedItem {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  deleted_at: string;
  deleted_by: string | null;
  snapshot_data: Record<string, any>;
  related_entities: Record<string, any> | null;
  expires_at: string | null;
  actor_name?: string;
}

export type EntityType = 'opportunities' | 'proposals' | 'accounts' | 'contacts' | 'activities' | 'contracts';

const entityLabels: Record<EntityType, string> = {
  opportunities: 'Oportunidade',
  proposals: 'Proposta',
  accounts: 'Empresa',
  contacts: 'Contato',
  activities: 'Atividade',
  contracts: 'Contrato',
};

export const getEntityLabel = (type: EntityType): string => entityLabels[type] || type;

const getEntityTitle = (entityType: string, data: Record<string, any>): string => {
  switch (entityType) {
    case 'opportunities':
      return data.title || 'Oportunidade sem título';
    case 'proposals':
      return data.proposal_number || data.title || 'Proposta sem número';
    case 'accounts':
      return data.razao_social || data.nome_fantasia || 'Empresa sem nome';
    case 'contacts':
      return data.nome || data.email || 'Contato sem nome';
    case 'activities':
      return data.title || data.type || 'Atividade sem título';
    case 'contracts':
      return data.numero_contrato || data.title || 'Contrato sem número';
    default:
      return 'Item sem título';
  }
};

export async function listDeletedItems(
  organizationId: string,
  filters?: {
    entityType?: EntityType;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<DeletedItem[]> {
  let query = supabase
    .from('entity_snapshots')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('snapshot_reason', 'before_delete')
    .order('created_at', { ascending: false });

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom.toISOString());
  }

  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo.toISOString());
  }

  const { data: snapshots, error } = await query;

  if (error) {
    console.error('Error fetching deleted items:', error);
    throw error;
  }

  if (!snapshots || snapshots.length === 0) {
    return [];
  }

  // Get actor profiles
  const actorIds = [...new Set(snapshots.map(s => s.created_by).filter(Boolean) as string[])];
  let profileMap = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', actorIds);

    if (profiles) {
      profileMap = new Map(profiles.map(p => [p.user_id, p.full_name || 'Usuário']));
    }
  }

  const items: DeletedItem[] = snapshots.map(snapshot => {
    const snapshotData = snapshot.snapshot_data as Record<string, any>;
    const title = getEntityTitle(snapshot.entity_type, snapshotData);
    
    return {
      id: snapshot.id,
      entity_type: snapshot.entity_type,
      entity_id: snapshot.entity_id,
      title,
      deleted_at: snapshot.created_at,
      deleted_by: snapshot.created_by,
      snapshot_data: snapshotData,
      related_entities: snapshot.related_entities as Record<string, any> | null,
      expires_at: snapshot.expires_at,
      actor_name: snapshot.created_by ? profileMap.get(snapshot.created_by) : undefined,
    };
  });

  // Apply search filter client-side
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(searchLower) ||
      item.entity_type.toLowerCase().includes(searchLower)
    );
  }

  return items;
}

export async function restoreFromSnapshot(snapshotId: string): Promise<{ success: boolean; error?: string; entityType?: string; entityId?: string }> {
  const { data, error } = await supabase.rpc('restore_from_snapshot', {
    p_snapshot_id: snapshotId,
  });

  if (error) {
    console.error('Error restoring from snapshot:', error);
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; error?: string; entity_type?: string; entity_id?: string };
  
  return {
    success: result.success,
    error: result.error,
    entityType: result.entity_type,
    entityId: result.entity_id,
  };
}

export async function restoreMultipleSnapshots(snapshotIds: string[]): Promise<{ 
  successCount: number; 
  failCount: number; 
  errors: string[] 
}> {
  const results = await Promise.all(
    snapshotIds.map(id => restoreFromSnapshot(id))
  );

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const errors = results.filter(r => r.error).map(r => r.error!);

  return { successCount, failCount, errors };
}

export async function permanentlyDeleteSnapshot(snapshotId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('entity_snapshots')
    .delete()
    .eq('id', snapshotId);

  if (error) {
    console.error('Error permanently deleting snapshot:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getTrashStats(organizationId: string): Promise<{
  total: number;
  byType: Record<EntityType, number>;
  expiringSoon: number;
}> {
  const { data: snapshots, error } = await supabase
    .from('entity_snapshots')
    .select('entity_type, expires_at')
    .eq('organization_id', organizationId)
    .eq('snapshot_reason', 'before_delete');

  if (error || !snapshots) {
    return {
      total: 0,
      byType: {} as Record<EntityType, number>,
      expiringSoon: 0,
    };
  }

  const byType: Record<string, number> = {};
  let expiringSoon = 0;
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  snapshots.forEach(s => {
    byType[s.entity_type] = (byType[s.entity_type] || 0) + 1;
    if (s.expires_at && new Date(s.expires_at) <= sevenDaysFromNow) {
      expiringSoon++;
    }
  });

  return {
    total: snapshots.length,
    byType: byType as Record<EntityType, number>,
    expiringSoon,
  };
}
