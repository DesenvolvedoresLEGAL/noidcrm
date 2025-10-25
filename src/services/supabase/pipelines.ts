import { supabase } from '@/integrations/supabase/client';
import { Pipeline, Stage } from '../crm/types';

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

  return pipelines.map(pipeline => ({
    ...pipeline,
    stages: stages.filter(s => s.pipeline_id === pipeline.id) as Stage[],
  })) as Pipeline[];
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

  return {
    ...pipeline,
    stages: stages as Stage[],
  } as Pipeline;
}

export async function createPipeline(data: Omit<Pipeline, 'id' | 'created_at' | 'stages'>): Promise<Pipeline> {
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert({
      name: data.name,
      type: data.type,
      color: data.color,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...pipeline,
    stages: [],
  } as Pipeline;
}

export async function updatePipeline(id: string, data: Partial<Pipeline>): Promise<Pipeline | null> {
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .update({
      name: data.name,
      color: data.color,
    })
    .eq('id', id)
    .select()
    .single();

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
  data: Omit<Stage, 'id' | 'pipeline_id' | 'created_at'>
): Promise<Stage | null> {
  const { data: stage, error } = await supabase
    .from('stages')
    .insert({
      pipeline_id: pipelineId,
      name: data.name,
      order_index: data.order_index,
      color: data.color,
    })
    .select()
    .single();

  if (error) throw error;
  return stage as Stage;
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
      order_index: data.order_index,
      color: data.color,
    })
    .eq('id', stageId)
    .eq('pipeline_id', pipelineId)
    .select()
    .single();

  if (error) throw error;
  return stage as Stage;
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
