import { supabase } from '@/integrations/supabase/client';
import { DeletedItem, EntityType, getEntityLabel } from './trash';

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

export interface AdminDeletedItem extends DeletedItem {
  organization_id: string;
  organization_name?: string;
}

export async function listAllDeletedItems(
  filters?: {
    organizationId?: string;
    entityType?: EntityType;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<AdminDeletedItem[]> {
  let query = supabase
    .from('entity_snapshots')
    .select('*')
    .eq('snapshot_reason', 'before_delete')
    .order('created_at', { ascending: false });

  if (filters?.organizationId) {
    query = query.eq('organization_id', filters.organizationId);
  }

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

  // Get organization names
  const orgIds = [...new Set(snapshots.map(s => s.organization_id))];
  let orgMap = new Map<string, string>();

  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);

    if (orgs) {
      orgMap = new Map(orgs.map(o => [o.id, o.name]));
    }
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

  const items: AdminDeletedItem[] = snapshots.map(snapshot => {
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
      organization_id: snapshot.organization_id,
      organization_name: orgMap.get(snapshot.organization_id),
    };
  });

  // Apply search filter client-side
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(searchLower) ||
      item.entity_type.toLowerCase().includes(searchLower) ||
      item.organization_name?.toLowerCase().includes(searchLower)
    );
  }

  return items;
}

export async function getAdminTrashStats(): Promise<{
  total: number;
  byType: Record<EntityType, number>;
  byOrganization: { id: string; name: string; count: number }[];
  expiringSoon: number;
}> {
  const { data: snapshots, error } = await supabase
    .from('entity_snapshots')
    .select('entity_type, expires_at, organization_id')
    .eq('snapshot_reason', 'before_delete');

  if (error || !snapshots) {
    return {
      total: 0,
      byType: {} as Record<EntityType, number>,
      byOrganization: [],
      expiringSoon: 0,
    };
  }

  // Get org names
  const orgIds = [...new Set(snapshots.map(s => s.organization_id))];
  let orgMap = new Map<string, string>();

  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);

    if (orgs) {
      orgMap = new Map(orgs.map(o => [o.id, o.name]));
    }
  }

  const byType: Record<string, number> = {};
  const byOrgCount: Record<string, number> = {};
  let expiringSoon = 0;
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  snapshots.forEach(s => {
    byType[s.entity_type] = (byType[s.entity_type] || 0) + 1;
    byOrgCount[s.organization_id] = (byOrgCount[s.organization_id] || 0) + 1;
    if (s.expires_at && new Date(s.expires_at) <= sevenDaysFromNow) {
      expiringSoon++;
    }
  });

  const byOrganization = Object.entries(byOrgCount).map(([id, count]) => ({
    id,
    name: orgMap.get(id) || 'Organização desconhecida',
    count,
  })).sort((a, b) => b.count - a.count);

  return {
    total: snapshots.length,
    byType: byType as Record<EntityType, number>,
    byOrganization,
    expiringSoon,
  };
}
