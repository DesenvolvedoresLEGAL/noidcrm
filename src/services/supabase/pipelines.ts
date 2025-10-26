import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const pipelineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  bu: z.array(z.enum(['ALUGUE', 'HUMANOID'])).min(1),
});

const stageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  position: z.number().min(0),
  color: z.string().optional(),
});

interface DBPipeline {
  id: string;
  name: string;
  type: string;
  color: string | null;
  created_at: string;
}

interface DBStage {
  id: string;
  pipeline_id: string;
  name: string;
  order_index: number;
  color: string | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  bu: ('ALUGUE' | 'HUMANOID')[];
  stages: Stage[];
  created_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color?: string;
  created_at: string;
}

function mapDBToPipeline(dbPipeline: DBPipeline, dbStages: DBStage[]): Pipeline {
  return {
    id: dbPipeline.id,
    name: dbPipeline.name,
    bu: [dbPipeline.type.toUpperCase() as 'ALUGUE' | 'HUMANOID'],
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
  
  const typeValue = validated.bu[0].toLowerCase();
  
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert({
      name: validated.name,
      type: typeValue,
    } as any)
    .select()
    .single();

  if (error) throw error;

  return mapDBToPipeline(pipeline as DBPipeline, []);
}

export async function updatePipeline(id: string, data: Partial<Pipeline>): Promise<Pipeline | null> {
  const { error } = await supabase
    .from('pipelines')
    .update({
      name: data.name,
    })
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
  
  const { data: stage, error } = await supabase
    .from('stages')
    .insert({
      pipeline_id: pipelineId,
      name: validated.name,
      order_index: validated.position,
      color: validated.color,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return mapDBToStage(stage as DBStage);
}

export async function updateStage(
  pipelineId: string,
  stageId: string,
  data: Partial<Stage>
): Promise<Stage | null> {
  const { data: stage, error } = await supabase
    .from('stages')
    .update({
      name: data.name,
      order_index: data.position,
      color: data.color,
    })
    .eq('id', stageId)
    .eq('pipeline_id', pipelineId)
    .select()
    .single();

  if (error) throw error;
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
