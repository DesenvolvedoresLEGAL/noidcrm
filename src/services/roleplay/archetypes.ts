import { supabase } from '@/integrations/supabase/client';
import type { ClientArchetypeType } from '@/roleplay/archetypes';

/**
 * Roleplay Archetype — universal runtime contract.
 *
 * Sprint: NOID-VERTICAL-1.0-VERT-01.4B2.
 *
 * `type` is now the generic `ClientArchetypeType` (string). The DB column is
 * `text` (see VERT-01.4B1). Events-specific values (Organizador, Expositor,
 * Agência, Empresa Contratante) are supplied by the Events Vertical Pack at
 * the composition/UI layer — this service is Pack-agnostic and MUST NOT
 * import from `@/vertical-packs/**`.
 */
export interface Archetype {
  id: string;
  name: string;
  type: ClientArchetypeType;
  level: 'Entrada' | 'Intermediário' | 'Avançado' | 'Enterprise';
  tone_style: 'técnico' | 'apressado' | 'cético' | 'indeciso' | 'agressivo' | 'metódico';
  decision_role: 'Decisor' | 'Influenciador' | 'Usuário-Chave';
  complexity_score: number;
  min_message_exchanges: number;
  objection_set: string[];
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export async function listArchetypes(organizationId: string): Promise<Archetype[]> {
  const { data, error } = await supabase
    .from('client_archetypes')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Archetype[];
}

export async function getArchetype(id: string): Promise<Archetype> {
  const { data, error } = await supabase
    .from('client_archetypes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Archetype;
}

export async function createArchetype(archetype: Omit<Archetype, 'id' | 'created_at' | 'updated_at'>): Promise<Archetype> {
  const { data, error } = await supabase
    .from('client_archetypes')
    .insert(archetype as any)
    .select()
    .single();

  if (error) throw error;
  return data as Archetype;
}

export async function updateArchetype(id: string, archetype: Partial<Archetype>): Promise<Archetype> {
  const { data, error } = await supabase
    .from('client_archetypes')
    .update(archetype as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Archetype;
}

export async function deleteArchetype(id: string): Promise<void> {
  const { error } = await supabase
    .from('client_archetypes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
