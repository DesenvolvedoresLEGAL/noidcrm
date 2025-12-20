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
  temperatura: z.enum(['cold', 'warm', 'hot', 'burning']).optional(),
  status: z.string().optional(),
  automation_enabled: z.boolean().optional(),
  close_date_prevista: z.string().optional(),
  origem: z.string().optional(),
  owner_user_id: z.string().uuid('ID de proprietário inválido').optional(),
}).passthrough();

export async function listOpportunities(params: {
  pipeline_id?: string;
  stage_id?: string;
  produto?: string;
  owner_user_id?: string;
  owner_user_ids?: string[]; // Suporte para múltiplos IDs (visibilidade por time)
  exclude_closed?: boolean;
} = {}): Promise<{ data: Opportunity[]; total: number }> {
  let query = supabase
    .from('opportunities')
    .select(`
      *,
      account:accounts(razao_social, nome_fantasia, lead_score, lead_grade, fit_score, intent_score, cidade, uf, origem_principal),
      contact:contacts(nome, cargo, emails, telefones)
    `, { count: 'exact' })
    .is('deleted_at', null); // Soft delete filter

  if (params.pipeline_id) {
    query = query.eq('pipeline_id', params.pipeline_id);
  }

  if (params.stage_id) {
    query = query.eq('stage_id', params.stage_id);
  }

  if (params.produto) {
    query = query.eq('produto', params.produto);
  }

  // Suporte para filtro de visibilidade por time (múltiplos IDs)
  if (params.owner_user_ids && params.owner_user_ids.length > 0) {
    query = query.in('owner_user_id', params.owner_user_ids);
  } else if (params.owner_user_id) {
    query = query.eq('owner_user_id', params.owner_user_id);
  }

  if (params.exclude_closed) {
    query = query.not('status', 'in', '("won","lost")');
  }

  const { data, error, count } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching opportunities:', error);
    throw error;
  }

  // Fetch owner profiles
  const ownerIds = [...new Set((data || []).map((opp: any) => opp.owner_user_id).filter(Boolean))];
  let ownerProfiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', ownerIds);
    
    if (profiles) {
      ownerProfiles = profiles.reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        return acc;
      }, {} as Record<string, { full_name: string | null; avatar_url: string | null }>);
    }
  }

  // Fetch pending activities count per opportunity
  const opportunityIds = (data || []).map((opp: any) => opp.id);
  let activitiesCounts: Record<string, number> = {};
  
  if (opportunityIds.length > 0) {
    const { data: activitiesData } = await supabase
      .from('activities')
      .select('opportunity_id')
      .in('opportunity_id', opportunityIds)
      .eq('status', 'pending');
    
    if (activitiesData) {
      activitiesCounts = activitiesData.reduce((acc, act) => {
        if (act.opportunity_id) {
          acc[act.opportunity_id] = (acc[act.opportunity_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
    }
  }

  // Fetch stages to get stagnation_alert_days
  const stageIds = [...new Set((data || []).map((opp: any) => opp.stage_id).filter(Boolean))];
  let stagesConfig: Record<string, { stagnation_alert_days: number | null }> = {};
  
  if (stageIds.length > 0) {
    const { data: stagesData } = await supabase
      .from('stages')
      .select('id, stagnation_alert_days')
      .in('id', stageIds);
    
    if (stagesData) {
      stagesConfig = stagesData.reduce((acc, stage) => {
        acc[stage.id] = { stagnation_alert_days: stage.stagnation_alert_days };
        return acc;
      }, {} as Record<string, { stagnation_alert_days: number | null }>);
    }
  }

  const mapped = (data || []).map((opp: any) => {
    const ownerProfile = ownerProfiles[opp.owner_user_id];
    const stageConfig = stagesConfig[opp.stage_id];
    
    // Calculate days in stage using stage_entered_at or updated_at
    const stageEnteredAt = opp.stage_entered_at || opp.updated_at || opp.created_at;
    const daysInStage = stageEnteredAt 
      ? Math.floor((Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    return {
      ...opp,
      account_name: opp.account?.razao_social || opp.account?.nome_fantasia || null,
      account_cidade: opp.account?.cidade || null,
      account_uf: opp.account?.uf || null,
      account_origem: opp.account?.origem_principal || null,
      contact_name: opp.contact?.nome || null,
      contact_cargo: opp.contact?.cargo || null,
      contact_email: opp.contact?.emails?.[0] || null,
      contact_phone: opp.contact?.telefones?.[0] || null,
      owner_name: ownerProfile?.full_name || null,
      owner_avatar_url: ownerProfile?.avatar_url || null,
      pending_activities_count: activitiesCounts[opp.id] || 0,
      days_in_stage: daysInStage,
      stagnation_alert_days: stageConfig?.stagnation_alert_days || 7,
      account: opp.account ? {
        lead_score: opp.account.lead_score,
        lead_grade: opp.account.lead_grade,
        fit_score: opp.account.fit_score,
        intent_score: opp.account.intent_score,
      } : null,
    };
  });

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
      contact:contacts(*),
      pipeline:pipelines(id, name, pipeline_type)
    `)
    .eq('id', id)
    .is('deleted_at', null) // Soft delete filter
    .maybeSingle();

  if (error) {
    console.error('Error fetching opportunity:', error);
    throw error;
  }

  if (!data) return null;

  // Fetch owner profile separately (no FK relationship)
  let owner = null;
  if (data.owner_user_id) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .eq('user_id', data.owner_user_id)
      .maybeSingle();
    owner = ownerProfile;
  }

  return { ...data, owner } as Opportunity | null;
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

  // Handle temperature from either field name (temperatura or temperature)
  const temperatureValue = validated.temperatura || validated.temperature || 'warm';

  const insertData: any = {
    title: validated.title || 'Nova Oportunidade',
    account_id: validated.account_id,
    contact_id: validated.contact_id,
    pipeline_id: pipelineId,
    stage_id: stageId,
    produto: validated.produto,
    valor_previsto: validated.valor_previsto,
    owner_user_id: validated.owner_user_id || user.id,
    status: validated.status || 'new',
    temperature: temperatureValue,
    prob: probValue,
    urgency_score: validated.urgency_score || 50,
    automation_enabled: validated.automation_enabled ?? true,
    organization_id: orgId,
    close_date_prevista: validated.close_date_prevista || null,
    origem: validated.origem || null,
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

  // Create win_loss_record for 'won' status
  if (status === 'won') {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: orgMembership } = await supabase.rpc('get_user_organization_id');
      
      if (orgMembership && data) {
        // Calculate sales cycle days
        const createdAt = new Date(data.created_at);
        const now = new Date();
        const salesCycleDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // Check if record already exists
        const { data: existingRecord } = await supabase
          .from('win_loss_records')
          .select('id')
          .eq('opportunity_id', id)
          .maybeSingle();

        if (!existingRecord) {
          await supabase
            .from('win_loss_records')
            .insert({
              organization_id: orgMembership,
              opportunity_id: id,
              outcome: 'won',
              final_value: data.valor_previsto || 0,
              sales_cycle_days: salesCycleDays,
              recorded_by: userData?.user?.id
            });
        }
      }
    } catch (recordError) {
      console.error('Error creating win_loss_record for won opportunity:', recordError);
      // Don't throw - the opportunity was still updated
    }
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

// Extended loss details interface
export interface LossDetailsInput {
  lossReasonId: string;
  comment?: string;
  competitor?: string;
  priceFactor?: boolean;
  timingFactor?: boolean;
  featureFactor?: boolean;
  relationshipFactor?: boolean;
}

// Extended win details interface
export interface WinDetailsInput {
  winReasonId: string;
  finalValue: number;
  discountPercent?: number;
  championContactId?: string;
  keyDifferentiator?: string;
  customerFeedback?: string;
  negotiationRounds?: number;
}

// Mark opportunity as won with detailed reason
export async function markOpportunityAsWon(
  id: string,
  details: WinDetailsInput
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .update({
      status: 'won',
      valor_previsto: details.finalValue,
    })
    .eq('id', id)
    .select(`
      *,
      account:accounts(razao_social, nome_fantasia, cnpj),
      contact:contacts(nome, cargo, emails, telefones)
    `)
    .single();

  if (error) {
    console.error('Error marking opportunity as won:', error);
    throw new Error(error.message);
  }

  // Create win_loss_record with all win details
  try {
    const { data: userData } = await supabase.auth.getUser();
    const { data: orgMembership } = await supabase.rpc('get_user_organization_id');
    
    if (orgMembership) {
      // Calculate sales cycle days
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const salesCycleDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check if record already exists
      const { data: existingRecord } = await supabase
        .from('win_loss_records')
        .select('id')
        .eq('opportunity_id', id)
        .maybeSingle();

      if (existingRecord) {
        // Update existing record
        await supabase
          .from('win_loss_records')
          .update({
            outcome: 'won',
            win_reason_id: details.winReasonId,
            final_value: details.finalValue,
            discount_percent: details.discountPercent || null,
            champion_contact_id: details.championContactId || null,
            key_differentiator: details.keyDifferentiator || null,
            customer_feedback: details.customerFeedback || null,
            negotiation_rounds: details.negotiationRounds || 1,
            sales_cycle_days: salesCycleDays,
            recorded_by: userData?.user?.id,
          })
          .eq('id', existingRecord.id);
      } else {
        // Create new record
        await supabase
          .from('win_loss_records')
          .insert({
            organization_id: orgMembership,
            opportunity_id: id,
            outcome: 'won',
            win_reason_id: details.winReasonId,
            final_value: details.finalValue,
            discount_percent: details.discountPercent || null,
            champion_contact_id: details.championContactId || null,
            key_differentiator: details.keyDifferentiator || null,
            customer_feedback: details.customerFeedback || null,
            negotiation_rounds: details.negotiationRounds || 1,
            sales_cycle_days: salesCycleDays,
            recorded_by: userData?.user?.id,
          });
      }

      // Trigger automatic memory extraction
      const winLossRecordId = existingRecord?.id;
      if (winLossRecordId) {
        triggerMemoryExtraction(winLossRecordId, orgMembership).catch(err => {
          console.error('[markOpportunityAsWon] Memory extraction failed:', err);
        });
      }
    }
  } catch (recordError) {
    console.error('Error creating win_loss_record:', recordError);
    // Don't throw - the opportunity was still marked as won
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

// Trigger automatic memory extraction from win/loss record
async function triggerMemoryExtraction(winLossRecordId: string, organizationId: string): Promise<void> {
  try {
    console.log('[triggerMemoryExtraction] Starting extraction for record:', winLossRecordId);
    
    const { data, error } = await supabase.functions.invoke('extract-memory-engine', {
      body: {
        source_type: 'win_loss',
        source_id: winLossRecordId,
        organization_id: organizationId
      }
    });

    if (error) {
      console.error('[triggerMemoryExtraction] Edge function error:', error);
      return;
    }

    console.log('[triggerMemoryExtraction] Extraction result:', data);
  } catch (err) {
    console.error('[triggerMemoryExtraction] Failed to trigger extraction:', err);
  }
}

// Mark opportunity as lost with detailed reason
export async function markOpportunityAsLost(
  id: string,
  details: LossDetailsInput
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .update({
      status: 'lost',
      loss_reason_id: details.lossReasonId,
      loss_comment: details.comment || null,
    })
    .eq('id', id)
    .select(`
      *,
      account:accounts(razao_social, nome_fantasia, cnpj),
      contact:contacts(nome, cargo, emails, telefones),
      loss_reason:loss_reasons(name)
    `)
    .single();

  if (error) {
    console.error('Error marking opportunity as lost:', error);
    throw new Error(error.message);
  }

  // Also create a win_loss_record for detailed tracking
  try {
    const { data: userData } = await supabase.auth.getUser();
    const { data: orgMembership } = await supabase.rpc('get_user_organization_id');
    
    if (orgMembership) {
      // Calculate sales cycle days
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const salesCycleDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      const { data: insertedRecord } = await supabase
        .from('win_loss_records')
        .insert({
          organization_id: orgMembership,
          opportunity_id: id,
          outcome: 'lost',
          reason_id: details.lossReasonId,
          reason_seller: details.comment || null,
          competitor: details.competitor || null,
          price_factor: details.priceFactor || false,
          timing_factor: details.timingFactor || false,
          feature_factor: details.featureFactor || false,
          relationship_factor: details.relationshipFactor || false,
          final_value: data.valor_previsto,
          sales_cycle_days: salesCycleDays,
          recorded_by: userData?.user?.id
        })
        .select('id')
        .single();

      // Trigger automatic memory extraction
      if (insertedRecord?.id) {
        triggerMemoryExtraction(insertedRecord.id, orgMembership).catch(err => {
          console.error('[markOpportunityAsLost] Memory extraction failed:', err);
        });
      }
    }
  } catch (recordError) {
    console.error('Error creating win_loss_record:', recordError);
    // Don't throw - the opportunity was still marked as lost
  }

  // Map the data to match the expected format
  const mapped = {
    ...data,
    account_name: data.account?.razao_social || data.account?.nome_fantasia || null,
    contact_name: data.contact?.nome || null,
    contact_email: data.contact?.emails?.[0] || null,
    contact_phone: data.contact?.telefones?.[0] || null,
    loss_reason_name: data.loss_reason?.name || null,
  };

  return mapped as Opportunity;
}

// Delete opportunity (soft delete via trigger)
export async function deleteOpportunity(id: string): Promise<void> {
  // First, remove references from opportunities that were duplicated from this one
  const { error: unlinkError } = await supabase
    .from('opportunities')
    .update({ source_opportunity_id: null })
    .eq('source_opportunity_id', id);

  if (unlinkError) {
    console.error('Error unlinking child opportunities:', unlinkError);
    // Continue anyway - the main delete will fail if there's still a constraint
  }

  // Delete will be intercepted by soft_delete_opportunity trigger
  const { data, error, count } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error deleting opportunity:', error);
    throw new Error(error.message);
  }

  // Note: With soft delete trigger, data will be empty because DELETE returns NULL
  // Check that opportunity was soft-deleted by verifying deleted_at is set
}

// List deleted opportunities (trash)
export async function listDeletedOpportunities(): Promise<{ data: any[]; total: number }> {
  const { data, error, count } = await supabase
    .from('opportunities')
    .select(`
      id, title, valor_previsto, status, deleted_at, pipeline_id,
      account:accounts(razao_social, nome_fantasia),
      pipeline:pipelines(name)
    `, { count: 'exact' })
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching deleted opportunities:', error);
    throw error;
  }

  const mapped = (data || []).map((opp: any) => ({
    ...opp,
    account_name: opp.account?.razao_social || opp.account?.nome_fantasia || null,
    pipeline_name: opp.pipeline?.name || null,
    days_until_permanent_delete: opp.deleted_at 
      ? Math.max(0, 30 - Math.floor((Date.now() - new Date(opp.deleted_at).getTime()) / (1000 * 60 * 60 * 24)))
      : 0,
  }));

  return { data: mapped, total: count || 0 };
}

// Restore a deleted opportunity
export async function restoreOpportunity(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_opportunity', { opportunity_id: id });

  if (error) {
    console.error('Error restoring opportunity:', error);
    throw new Error('Não foi possível restaurar a oportunidade.');
  }
}
