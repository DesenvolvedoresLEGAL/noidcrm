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
      contact:contacts(nome, cargo)
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

  return {
    data: (data || []) as Opportunity[],
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
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const insertData: any = {
    title: validated.title || 'Nova Oportunidade',
    account_id: validated.account_id,
    contact_id: validated.contact_id,
    pipeline_id: validated.pipeline_id || 'pipeline-vendas',
    stage_id: validated.stage_id || 'stage-discovery',
    produto: validated.produto,
    valor_previsto: validated.valor_previsto,
    owner_user_id: user.id,
    status: validated.status || 'new',
    temperature: validated.temperature || 'warm',
    prob: validated.prob || 50,
    urgency_score: validated.urgency_score || 50,
    automation_enabled: validated.automation_enabled ?? true,
    organization_id: memberData?.organization_id,
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
