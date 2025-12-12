import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OpportunityDetails {
  id: string;
  title: string;
  valor_previsto: number | null;
  prob: number | null;
  status: string;
  temperature: string | null;
  produto: string | null;
  close_date_prevista: string | null;
  created_at: string;
  updated_at: string | null;
  observations?: string | null;
  location?: string | null;
  meta?: any;
  pipeline_id: string;
  stage_id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string;
  origin_id?: string | null;
  loss_reason_id?: string | null;
  loss_comment?: string | null;
  // Handoff/origin fields
  source_opportunity_id?: string | null;
  qualified_by_user_id?: string | null;
  qualified_at?: string | null;
  source_opportunity?: {
    id: string;
    title: string;
    pipeline: { name: string } | null;
    stage: { name: string } | null;
  } | null;
  qualified_by?: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  // Joined data
  account: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    telefones: any;
    emails: string[] | null;
  } | null;
  contact: {
    id: string;
    nome: string;
    cargo: string | null;
    emails: string[] | null;
    telefones: string[] | null;
  } | null;
  pipeline: {
    id: string;
    name: string;
    pipeline_type: 'qualification' | 'sales' | 'onboarding' | 'renewal' | null;
  } | null;
  stage: {
    id: string;
    name: string;
    order_index: number;
  } | null;
  stages: Array<{
    id: string;
    name: string;
    order_index: number;
  }>;
  origin: {
    id: string;
    name: string;
  } | null;
  loss_reason: {
    id: string;
    name: string;
  } | null;
  owner: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
}

async function fetchOpportunityDetails(id: string): Promise<OpportunityDetails> {
  // Fetch opportunity with all related data (WITHOUT owner join to avoid PGRST200)
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      account:accounts(id, razao_social, nome_fantasia, cnpj, telefones, emails),
      contact:contacts(id, nome, cargo, emails, telefones),
      pipeline:pipelines(id, name, pipeline_type),
      stage:stages(id, name, order_index),
      loss_reason:loss_reasons(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[useOpportunityDetails] Error fetching opportunity:', error);
    throw new Error('Oportunidade não encontrada');
  }

  // Fetch owner SEPARATELY to avoid FK constraint issues
  let owner = null;
  if (opportunity.owner_user_id) {
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, email')
      .eq('user_id', opportunity.owner_user_id)
      .maybeSingle();
    owner = ownerData;
  }

  // Fetch qualified_by user (handoff origin)
  let qualified_by = null;
  if (opportunity.qualified_by_user_id) {
    const { data: qualifiedByData } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .eq('user_id', opportunity.qualified_by_user_id)
      .maybeSingle();
    qualified_by = qualifiedByData;
  }

  // Fetch source opportunity details
  let source_opportunity = null;
  if (opportunity.source_opportunity_id) {
    const { data: sourceOppData } = await supabase
      .from('opportunities')
      .select(`
        id, title,
        pipeline:pipelines(name),
        stage:stages(name)
      `)
      .eq('id', opportunity.source_opportunity_id)
      .maybeSingle();
    source_opportunity = sourceOppData;
  }

  // Fetch all stages for this pipeline
  const { data: stages } = await supabase
    .from('stages')
    .select('id, name, order_index')
    .eq('pipeline_id', opportunity.pipeline_id)
    .order('order_index');

  return {
    ...opportunity,
    owner,
    qualified_by,
    source_opportunity,
    origin: null,
    stages: stages || [],
  } as unknown as OpportunityDetails;
}

export function useOpportunityDetails(id: string) {
  return useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => fetchOpportunityDetails(id),
    enabled: !!id,
  });
}
