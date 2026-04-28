import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const pipelineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  bu: z.array(z.enum(['ALUGUE', 'HUMANOID'])).min(1).optional(), // Legacy
  business_unit_ids: z.array(z.string().uuid()).min(1, 'At least one business unit is required'),
  pipeline_type: z.enum(['sales', 'qualification', 'onboarding', 'renewal']).optional(),
});

const stageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  position: z.number().min(0).optional(),
  color: z.string().optional(),
  description: z.string().max(1000).optional(),
  probability: z.number().min(0).max(100).optional(),
  stagnation_alert_days: z.number().min(0).optional(),
  allow_create_opportunity: z.boolean().optional(),
  allow_win_opportunity: z.boolean().optional(),
  allow_lose_opportunity: z.boolean().optional(),
});

export type LeadDistributionStrategy = 'none' | 'round_robin' | 'load_balanced' | 'random' | 'territory';

interface DBPipeline {
  id: string;
  name: string;
  type: string;
  pipeline_type: string | null;
  is_primary: boolean | null;
  color: string | null;
  business_unit_ids: string[] | null;
  lead_distribution_strategy: string | null;
  lead_distribution_role: string | null;
  lead_distribution_user_ids: string[] | null;
  created_at: string;
}

interface DBStage {
  id: string;
  pipeline_id: string;
  name: string;
  order_index: number;
  color: string | null;
  description?: string | null;
  probability?: number | null;
  stagnation_alert_days?: number | null;
  allow_create_opportunity?: boolean | null;
  allow_win_opportunity?: boolean | null;
  allow_lose_opportunity?: boolean | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  pipeline_type?: 'sales' | 'qualification' | 'onboarding' | 'renewal';
  is_primary?: boolean;
  bu: ('ALUGUE' | 'HUMANOID')[]; // Legacy field for compatibility
  business_unit_ids: string[];
  stages: Stage[];
  created_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color?: string;
  description?: string;
  probability?: number;
  stagnation_alert_days?: number;
  allow_create_opportunity?: boolean;
  allow_win_opportunity?: boolean;
  allow_lose_opportunity?: boolean;
  created_at: string;
}

const LEGACY_TYPES = ['ALUGUE', 'HUMANOID'] as const;
type LegacyType = typeof LEGACY_TYPES[number];

function normalizeLegacyType(type?: string | null): LegacyType[] {
  if (!type) return [];

  const normalized = type.toUpperCase() as LegacyType;
  return LEGACY_TYPES.includes(normalized) ? [normalized] : [];
}

function mapDBToPipeline(dbPipeline: DBPipeline, dbStages: DBStage[]): Pipeline {
  return {
    id: dbPipeline.id,
    name: dbPipeline.name,
    pipeline_type: (dbPipeline.pipeline_type as Pipeline['pipeline_type']) || undefined,
    is_primary: dbPipeline.is_primary ?? false,
    bu: normalizeLegacyType(dbPipeline.type),
    business_unit_ids: dbPipeline.business_unit_ids || [],
    stages: dbStages.map(mapDBToStage),
    created_at: dbPipeline.created_at,
  };
}

function mapDBToStage(dbStage: DBStage): Stage {
  return {
    id: dbStage.id,
    pipeline_id: dbStage.pipeline_id,
    name: dbStage.name,
    position: dbStage.order_index,
    color: dbStage.color || undefined,
    description: dbStage.description ?? undefined,
    probability: dbStage.probability ?? undefined,
    stagnation_alert_days: dbStage.stagnation_alert_days ?? undefined,
    allow_create_opportunity: dbStage.allow_create_opportunity ?? undefined,
    allow_win_opportunity: dbStage.allow_win_opportunity ?? undefined,
    allow_lose_opportunity: dbStage.allow_lose_opportunity ?? undefined,
    created_at: dbStage.created_at,
  };
}

export async function listPipelines(): Promise<Pipeline[]> {
  const { data: pipelines, error: pipelinesError } = await supabase
    .from('pipelines')
    .select('*')
    .order('created_at', { ascending: true });

  if (pipelinesError) throw pipelinesError;

  const { data: stages, error: stagesError } = await supabase
    .from('stages')
    .select('*')
    .order('order_index', { ascending: true });

  if (stagesError) throw stagesError;

  return pipelines.map(pipeline => 
    mapDBToPipeline(pipeline, stages.filter(s => s.pipeline_id === pipeline.id))
  );
}

export async function getPipeline(id: string): Promise<Pipeline | null> {
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (pipelineError) throw pipelineError;
  if (!pipeline) return null;

  const { data: stages, error: stagesError } = await supabase
    .from('stages')
    .select('*')
    .eq('pipeline_id', id)
    .order('order_index', { ascending: true });

  if (stagesError) throw stagesError;

  return mapDBToPipeline(pipeline, stages);
}

export async function createPipeline(dto: unknown): Promise<Pipeline> {
  // Validate input
  const validated = pipelineSchema.parse(dto);
  
  // Get organization via RPC
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    console.error('[createPipeline] Failed to get organization:', orgError);
    throw new Error('Organização não encontrada para o usuário');
  }
  
  const typeValue = validated.bu?.[0] ?? 'CUSTOM';

  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert({
      id: crypto.randomUUID(),
      name: validated.name.trim(),
      type: typeValue,
      pipeline_type: validated.pipeline_type || 'sales',
      business_unit_ids: validated.business_unit_ids,
      organization_id: orgId,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('[createPipeline] Insert failed:', error);
    throw error;
  }

  return mapDBToPipeline(pipeline as DBPipeline, []);
}

export async function updatePipeline(id: string, data: Partial<Pipeline>): Promise<Pipeline | null> {
  const updates: any = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.business_unit_ids !== undefined) {
    updates.business_unit_ids = data.business_unit_ids;
  }
  if (data.pipeline_type !== undefined) {
    updates.pipeline_type = data.pipeline_type;
  }
  if (data.is_primary !== undefined) {
    updates.is_primary = data.is_primary;
  }

  if (data.bu !== undefined) {
    updates.type = data.bu[0] ?? 'CUSTOM';
  }

  const { error } = await supabase
    .from('pipelines')
    .update(updates)
    .eq('id', id);

  if (error) throw error;

  return getPipeline(id);
}

export async function deletePipeline(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function createStage(
  pipelineId: string,
  dto: unknown
): Promise<Stage | null> {
  // Validate input
  const validated = stageSchema.parse(dto);
  
  // Get organization via RPC
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    console.error('[createStage] Failed to get organization:', orgError);
    throw new Error('Organização não encontrada para o usuário');
  }

  // Calculate next order_index if position not provided
  let orderIndex: number;
  
  if (validated.position !== undefined && Number.isFinite(validated.position)) {
    orderIndex = validated.position;
  } else {
    const { data: lastStage, error: lastError } = await supabase
      .from('stages')
      .select('order_index')
      .eq('pipeline_id', pipelineId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (lastError) {
      console.error('[createStage] Failed to get last stage:', lastError);
      throw lastError;
    }
    
    orderIndex = (lastStage?.order_index ?? -1) + 1;
  }

  // Normalize numeric values
  const probability = validated.probability === undefined 
    ? null 
    : Math.max(0, Math.min(100, Math.round(validated.probability)));
  
  const stagnationAlert = validated.stagnation_alert_days === undefined
    ? null
    : Math.max(0, Math.round(validated.stagnation_alert_days));
  
  const { data: stage, error } = await supabase
    .from('stages')
    .insert({
      id: crypto.randomUUID(),
      pipeline_id: pipelineId,
      name: validated.name.trim(),
      order_index: orderIndex,
      color: validated.color || null,
      description: validated.description || null,
      probability,
      stagnation_alert_days: stagnationAlert,
      allow_create_opportunity: validated.allow_create_opportunity ?? true,
      allow_win_opportunity: validated.allow_win_opportunity ?? false,
      allow_lose_opportunity: validated.allow_lose_opportunity ?? true,
      organization_id: orgId,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('[createStage] Insert failed:', error);
    throw error;
  }
  
  return mapDBToStage(stage as DBStage);
}

export async function updateStage(
  pipelineId: string,
  stageId: string,
  data: Partial<Stage>
): Promise<Stage | null> {
  const updates: any = {};
  
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.position !== undefined) updates.order_index = data.position;
  if (data.color !== undefined) updates.color = data.color;
  if (data.description !== undefined) updates.description = data.description;
  
  // Normalize probability
  if (data.probability !== undefined) {
    updates.probability = Math.max(0, Math.min(100, Math.round(data.probability)));
  }
  
  // Normalize stagnation alert days
  if (data.stagnation_alert_days !== undefined) {
    updates.stagnation_alert_days = Math.max(0, Math.round(data.stagnation_alert_days));
  }
  
  if (data.allow_create_opportunity !== undefined) updates.allow_create_opportunity = data.allow_create_opportunity;
  if (data.allow_win_opportunity !== undefined) updates.allow_win_opportunity = data.allow_win_opportunity;
  if (data.allow_lose_opportunity !== undefined) updates.allow_lose_opportunity = data.allow_lose_opportunity;

  const { data: stage, error } = await supabase
    .from('stages')
    .update(updates)
    .eq('id', stageId)
    .eq('pipeline_id', pipelineId)
    .select()
    .single();

  if (error) {
    console.error('[updateStage] Update failed:', error);
    throw error;
  }
  
  return mapDBToStage(stage);
}

export async function deleteStage(pipelineId: string, stageId: string): Promise<boolean> {
  const { error } = await supabase
    .from('stages')
    .delete()
    .eq('id', stageId)
    .eq('pipeline_id', pipelineId);

  if (error) throw error;
  return true;
}
