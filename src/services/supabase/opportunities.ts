import { supabase } from '@/integrations/supabase/client';
import { Opportunity } from '../crm/types';
import { z } from 'zod';

const opportunitySchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  valor_previsto: z.number().min(0, 'Valor deve ser positivo').optional(),
  prob: z.number().min(0).max(100, 'Probabilidade deve estar entre 0 e 100').optional(),
  urgency_score: z.number().min(0).max(100).optional(),
  account_id: z.string().uuid('ID de conta inválido').optional(),
  contact_id: z.string().uuid('ID de contato inválido').optional(),
  pipeline_id: z.string().optional(),
  stage_id: z.string().optional(),
  produto: z.string().max(100).optional(),
  temperature: z.enum(['cold', 'warm', 'hot', 'burning']).optional(),
  status: z.string().optional(),
  automation_enabled: z.boolean().optional(),
}).passthrough();

export async function listOpportunities(params: {
  pipeline_id?: string;
  stage_id?: string;
  produto?: string;
} = {}): Promise<{ data: Opportunity[]; total: number }> {
  let query = supabase
    .from('opportunities')
    .select(`
      *,
      account:accounts(razao_social, nome_fantasia),
      contact:contacts(nome, cargo, emails, telefones)
    `, { count: 'exact' });

  if (params.pipeline_id) {
    query = query.eq('pipeline_id', params.pipeline_id);
  }

  if (params.stage_id) {
    query = query.eq('stage_id', params.stage_id);
  }

  if (params.produto) {
    query = query.eq('produto', params.produto);
  }

  const { data, error, count } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching opportunities:', error);
    throw error;
  }

  const mapped = (data || []).map((opp: any) => ({
    ...opp,
    account_name: opp.account?.razao_social || opp.account?.nome_fantasia || null,
    contact_name: opp.contact?.nome || null,
    contact_email: opp.contact?.emails?.[0] || null,
    contact_phone: opp.contact?.telefones?.[0] || null,
  }));

  return {
    data: mapped as Opportunity[],
    total: count || 0,
  };
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      account:accounts(*),
      contact:contacts(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching opportunity:', error);
    throw error;
  }

  return data as Opportunity | null;
}

export async function createOpportunity(dto: unknown): Promise<Opportunity> {
  // Validate input
  const validated = opportunitySchema.parse(dto);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    console.error('[createOpportunity] Failed to get organization_id', orgError);
    throw new Error('User must belong to an organization to create opportunities');
  }

  // Normalize probability: accept 0-1 or 0-100
  const probValue = typeof validated.prob === 'number'
    ? (validated.prob <= 1 ? Math.round(validated.prob * 100) : Math.round(validated.prob))
    : 50;

  let pipelineId = validated.pipeline_id;
  let stageId = validated.stage_id;

  if (!pipelineId || !stageId) {
    const { data: defaultPipeline, error: defaultPipelineError } = await supabase
      .from('pipelines')
      .select('id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultPipelineError) {
      console.error('[createOpportunity] Failed to fetch default pipeline', defaultPipelineError);
      throw new Error('Não foi possível determinar o pipeline padrão. Selecione um pipeline ao criar a oportunidade.');
    }

    pipelineId = pipelineId ?? defaultPipeline?.id ?? null;

    if (pipelineId) {
      const { data: defaultStage, error: defaultStageError } = await supabase
        .from('stages')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultStageError) {
        console.error('[createOpportunity] Failed to fetch default stage', defaultStageError);
        throw new Error('Não foi possível determinar a etapa inicial do pipeline selecionado.');
      }

      stageId = stageId ?? defaultStage?.id ?? null;
    }

    if (!pipelineId || !stageId) {
      throw new Error('Configure um pipeline e etapa padrão antes de criar oportunidades.');
    }
  }

  const insertData: any = {
    title: validated.title || 'Nova Oportunidade',
    account_id: validated.account_id,
    contact_id: validated.contact_id,
    pipeline_id: pipelineId,
    stage_id: stageId,
    produto: validated.produto,
    valor_previsto: validated.valor_previsto,
    owner_user_id: user.id,
    status: validated.status || 'new',
    temperature: validated.temperature || 'warm',
    prob: probValue,
    urgency_score: validated.urgency_score || 50,
    automation_enabled: validated.automation_enabled ?? true,
    organization_id: orgId,
  };

  const { data, error } = await supabase
    .from('opportunities')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating opportunity:', error);
    throw error;
  }

  return data as Opportunity;
}

export async function advanceOpportunity(id: string, targetStageId: string): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .update({ stage_id: targetStageId })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error advancing opportunity:', error);
    throw error;
  }

  return data as Opportunity;
}

export async function moveOpportunity(id: string, newStageId: string): Promise<Opportunity> {
  return advanceOpportunity(id, newStageId);
}

export async function updateOpportunityStatus(
  id: string,
  status: 'won' | 'lost'
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating opportunity status:', error);
    throw error;
  }

  return data as Opportunity;
}

// Update opportunity with partial data
export async function updateOpportunity(id: string, updates: Partial<any>): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      account:accounts(razao_social, nome_fantasia, cnpj),
      contact:contacts(nome, cargo, emails, telefones)
    `)
    .single();

  if (error) {
    console.error('Error updating opportunity:', error);
    throw new Error(error.message);
  }

  // Map the data to match the expected format
  const mapped = {
    ...data,
    account_name: data.account?.razao_social || data.account?.nome_fantasia || null,
    contact_name: data.contact?.nome || null,
    contact_email: data.contact?.emails?.[0] || null,
    contact_phone: data.contact?.telefones?.[0] || null,
  };

  return mapped as Opportunity;
}
