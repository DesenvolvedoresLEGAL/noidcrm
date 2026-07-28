import { supabase } from '@/integrations/supabase/client';
import { Opportunity } from '../crm/types';
import { z } from 'zod';
import { collectAuditContext, type AuditContext } from '@/lib/auditContext';

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

// SPRINT PERF 0.6B (corrigida pós-P0) — Lista explícita usada quando o
// caller pede `projection:'kanban'`. Mantida correta contra o schema real
// para evitar 400 do PostgREST (colunas inexistentes derrubam toda a
// query, fazendo cards sumirem). Reaplicar somente após comparar payload.
//
// IMPORTANTE: `stage_entered_at` e `meta` NÃO existem em `opportunities`.
// `days_in_stage` cai automaticamente para `updated_at || created_at`.
const KANBAN_OPPORTUNITY_COLUMNS = [
  'id', 'title', 'status', 'pipeline_id', 'stage_id', 'owner_user_id',
  'account_id', 'contact_id', 'produto', 'valor_previsto', 'prob',
  'temperature', 'temperatura', 'close_date_prevista',
  'closed_at', 'accepted_proposal_id',
  'created_at', 'updated_at', 'deleted_at',
  'engagement_score', 'velocity_score', 'risk_score',
  'opportunity_score', 'win_probability_ai',
  'nrhs_score', 'nrhs_tier', 'nrhs_issues_count', 'nrhs_blockers',
].join(', ');

export async function listOpportunities(params: {
  pipeline_id?: string;
  stage_id?: string;
  produto?: string;
  owner_user_id?: string;
  owner_user_ids?: string[]; // Suporte para múltiplos IDs (visibilidade por time)
  exclude_closed?: boolean;
  limit?: number;
  offset?: number;
  /** SPRINT PERF 0.6B — opt-in narrow projection. Defaults to '*' for backward compatibility. */
  projection?: 'kanban' | 'full';
} = {}): Promise<{ data: Opportunity[]; total: number }> {
  // Performance: avoid `count: 'exact'` (full second pass) and cap rows.
  // The Kanban can render thousands of cards; with an unbounded query the
  // PostgREST plan times out at the database statement_timeout.
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 1000);
  const offset = Math.max(params.offset ?? 0, 0);

  const oppColumns = params.projection === 'kanban' ? KANBAN_OPPORTUNITY_COLUMNS : '*';

  let query = supabase
    .from('opportunities')
    .select(`
      ${oppColumns},
      account:accounts(razao_social, nome_fantasia, lead_score, lead_grade, fit_score, intent_score, cidade, uf, origem_principal, score_financeiro, risco_financeiro, score_fatores),
      contact:contacts(nome, cargo, emails, telefones)
    `, { count: 'estimated' })
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

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

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

  // Helper to extract string from JSONB email/phone arrays or objects
  const extractEmailStr = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      // Prefer the item marked as primary
      const primary = val.find((v: any) => v && typeof v === 'object' && v.is_primary);
      const first = primary || val.find(Boolean);
      return extractEmailStr(first);
    }
    if (typeof val === 'object') {
      const candidate = val.email ?? val.value ?? val.address;
      return typeof candidate === 'string' ? candidate : null;
    }
    return null;
  };

  const extractPhoneStr = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      // Prefer the item marked as primary
      const primary = val.find((v: any) => v && typeof v === 'object' && v.is_primary);
      const first = primary || val.find(Boolean);
      return extractPhoneStr(first);
    }
    if (typeof val === 'object') {
      const candidate = val.numero ?? val.phone ?? val.value ?? val.number;
      return typeof candidate === 'string' ? candidate : null;
    }
    return null;
  };

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
      // Normalize to string to prevent React #31 error
      contact_email: extractEmailStr(opp.contact?.emails),
      contact_phone: extractPhoneStr(opp.contact?.telefones),
      owner_name: ownerProfile?.full_name || null,
      owner_avatar_url: ownerProfile?.avatar_url || null,
      pending_activities_count: activitiesCounts[opp.id] || 0,
      days_in_stage: daysInStage,
      stagnation_alert_days: stageConfig?.stagnation_alert_days || 7,
      // NRHS fields
      nrhs_score: opp.nrhs_score ?? null,
      nrhs_tier: opp.nrhs_tier ?? null,
      nrhs_issues_count: opp.nrhs_issues_count ?? null,
      nrhs_blockers: opp.nrhs_blockers ?? null,
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

/**
 * Lightweight server-side search for the proposal opportunity picker.
 * Returns at most `limit` open opportunities matching `q` by title.
 * Used exclusively by `ProposalModal` — does NOT replace `listOpportunities`
 * used by the Kanban. Always filters out soft-deleted and closed (won/lost)
 * opportunities to keep the picker focused on actionable deals.
 */
export async function searchOpportunitiesForProposalPicker(params: {
  q?: string;
  limit?: number;
  includeId?: string; // ensures the currently selected opportunity is included (edit mode)
} = {}): Promise<Array<{ id: string; title: string | null; status: string | null }>> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const q = (params.q ?? '').trim();

  let query = supabase
    .from('opportunities')
    .select('id, title, status, created_at')
    .is('deleted_at', null)
    .not('status', 'in', '("won","lost")')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (q.length > 0) {
    // Escape PostgREST wildcards in user input
    const safe = q.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.ilike('title', `%${safe}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const results = (data || []) as Array<{ id: string; title: string | null; status: string | null }>;

  // Ensure the currently selected opportunity is present (edit mode), even if
  // it doesn't match the current search or has been closed since.
  if (params.includeId && !results.some((r) => r.id === params.includeId)) {
    const { data: extra } = await supabase
      .from('opportunities')
      .select('id, title, status')
      .eq('id', params.includeId)
      .is('deleted_at', null)
      .maybeSingle();
    if (extra) {
      results.unshift(extra as { id: string; title: string | null; status: string | null });
    }
  }

  return results;
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

  // If no owner specified and pipeline has lead distribution configured, try claim.
  // IMPORTANT: never silently reassign to a third user — if claim returns someone
  // other than the current user AND the caller didn't ask for a specific owner,
  // keep the creator as owner so RLS doesn't hide the freshly-inserted row.
  let resolvedOwner: string | null = validated.owner_user_id || null;
  const callerRequestedOwner = Boolean(validated.owner_user_id);
  if (!resolvedOwner && pipelineId) {
    try {
      let accountUf: string | null = null;
      if (validated.account_id) {
        const { data: acc } = await supabase
          .from('accounts')
          .select('uf')
          .eq('id', validated.account_id)
          .maybeSingle();
        accountUf = acc?.uf ?? null;
      }
      const { data: claimed } = await supabase.rpc('claim_next_owner_v2', {
        _organization_id: orgId as any,
        _pipeline_id: pipelineId,
        _account_uf: accountUf,
      });
      if (claimed && (callerRequestedOwner || claimed === user.id)) {
        resolvedOwner = claimed as string;
      }
    } catch (e) {
      console.warn('[createOpportunity] claim_next_owner_v2 failed', e);
    }
  }
  resolvedOwner = resolvedOwner || user.id;

  const insertData: any = {
    title: validated.title || 'Nova Oportunidade',
    account_id: validated.account_id,
    contact_id: validated.contact_id,
    pipeline_id: pipelineId,
    stage_id: stageId,
    produto: validated.produto,
    valor_previsto: validated.valor_previsto,
    owner_user_id: resolvedOwner,
    status: validated.status || 'new',
    temperature: temperatureValue,
    prob: probValue,
    urgency_score: validated.urgency_score || 50,
    automation_enabled: validated.automation_enabled ?? true,
    organization_id: orgId,
    close_date_prevista: validated.close_date_prevista || null,
    origem: validated.origem || null,
  };

  const { data: inserted, error } = await supabase
    .from('opportunities')
    .insert(insertData)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating opportunity:', error);
    throw error;
  }

  // Defensive: if RLS SELECT hides the freshly-inserted row (owner reassigned
  // by trigger, team-visibility policy, etc.), the INSERT still succeeded. Try
  // to recover the row so the UI closes cleanly instead of leaving the modal
  // open on a false-negative error.
  let data: any = inserted;
  if (!data) {
    console.warn('[createOpportunity] insert returned no row via RLS SELECT — attempting recovery');
    const { data: recovered } = await supabase
      .from('opportunities')
      .select()
      .eq('organization_id', orgId as any)
      .eq('title', insertData.title)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recovered) {
      data = recovered;
    } else {
      data = { ...insertData, id: crypto.randomUUID(), created_by: user.id };
    }
  }

  console.info('[createOpportunity] inserted', {
    id: (data as any)?.id,
    pipeline_id: (data as any)?.pipeline_id,
    stage_id: (data as any)?.stage_id,
    owner_user_id: (data as any)?.owner_user_id,
  });

  // Auto-fill account responsibles based on pipeline type if missing
  if (validated.account_id) {
    try {
      const { data: pipelineRow } = await supabase
        .from('pipelines')
        .select('pipeline_type')
        .eq('id', pipelineId)
        .maybeSingle();
      const ptype = pipelineRow?.pipeline_type;

      const { data: acc } = await supabase
        .from('accounts')
        .select('owner_user_id, cs_user_id, pre_sales_user_id')
        .eq('id', validated.account_id)
        .maybeSingle();

      if (acc) {
        const updates: Record<string, string> = {};
        const ownerToSet = resolvedOwner || user.id;
        if (ptype === 'qualification' && !acc.pre_sales_user_id) {
          updates.pre_sales_user_id = ownerToSet;
        } else if (ptype === 'sales' && !acc.owner_user_id) {
          updates.owner_user_id = ownerToSet;
        } else if ((ptype === 'onboarding' || ptype === 'renewal') && !acc.cs_user_id) {
          updates.cs_user_id = ownerToSet;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('accounts').update(updates).eq('id', validated.account_id);
        }
      }
    } catch (e) {
      console.warn('[createOpportunity] auto-fill account responsibles failed', e);
    }
  }

  return data as Opportunity;
}

/**
 * Duplica uma oportunidade existente com deep clone dos relacionamentos
 * essenciais (tags, participantes, custom fields). Reseta status para 'new'
 * e vincula ao source via source_opportunity_id.
 */
export async function duplicateOpportunity(sourceId: string): Promise<Opportunity> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // 1) Buscar oportunidade original
  const { data: source, error: fetchError } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', sourceId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    console.error('[duplicateOpportunity] fetch source failed', fetchError);
    throw fetchError;
  }
  if (!source) throw new Error('Oportunidade original não encontrada');

  // 2) Montar payload limpo (remover chaves únicas/derivadas)
  const excluded = new Set([
    'id', 'created_at', 'updated_at', 'deleted_at', 'closed_at',
    'won_at', 'lost_at', 'accepted_proposal_id', 'accepted_at',
    'public_token', 'public_token_created_at', 'signature_hash',
    'client_ip', 'user_agent', 'search_vector',
    'score', 'grade', 'health_status', 'score_calculated_at',
    'requires_seller_classification', 'reopened_at', 'reopened_by',
    'reopen_reason', 'source_opportunity_id', 'qualified_by_user_id',
    'qualified_at', 'is_cancelled_sale', 'cancelled_at', 'cancelled_by',
    'cancellation_reason',
  ]);

  const insertPayload: Record<string, any> = {};
  for (const [key, value] of Object.entries(source as Record<string, any>)) {
    if (!excluded.has(key) && value !== undefined) {
      insertPayload[key] = value;
    }
  }

  insertPayload.title = `CÓPIA - ${source.title || 'Oportunidade'}`;
  insertPayload.status = 'new';
  // Não vinculamos source_opportunity_id para não colidir com o unique index
  // `opportunities_no_duplicate_handoff_uidx` (reservado para handoffs de workflow).
  insertPayload.created_by = user.id;
  insertPayload.owner_user_id = source.owner_user_id || user.id;

  const orgId = (source as any).organization_id;

  const { data: created, error: insertError } = await supabase
    .from('opportunities')
    .insert(insertPayload as any)
    .select()
    .single();

  if (insertError) {
    console.error('[duplicateOpportunity] insert failed', insertError);
    throw insertError;
  }

  const newId = (created as any).id as string;

  // 3) Deep clone: tags
  try {
    const { data: tags } = await supabase
      .from('opportunity_tags')
      .select('tag_id')
      .eq('opportunity_id', sourceId);
    if (tags && tags.length > 0) {
      const tagRows = tags.map((t: any) => ({
        opportunity_id: newId,
        tag_id: t.tag_id,
        organization_id: orgId,
      }));
      await supabase.from('opportunity_tags').insert(tagRows as any);
    }
  } catch (e) {
    console.warn('[duplicateOpportunity] copy tags failed', e);
  }

  // 4) Deep clone: participantes do deal
  try {
    const { data: participants } = await supabase
      .from('deal_participants')
      .select('user_id, role, share_percentage')
      .eq('opportunity_id', sourceId);
    if (participants && participants.length > 0) {
      const rows = participants.map((p: any) => ({
        opportunity_id: newId,
        user_id: p.user_id,
        role: p.role,
        share_percentage: p.share_percentage,
        organization_id: orgId,
      }));
      await supabase.from('deal_participants').insert(rows as any);
    }
  } catch (e) {
    console.warn('[duplicateOpportunity] copy participants failed', e);
  }

  // 5) Deep clone: custom fields
  try {
    const { data: cfvs } = await supabase
      .from('custom_field_values')
      .select('custom_field_id, value')
      .eq('entity_id', sourceId)
      .eq('entity_type', 'opportunity');
    if (cfvs && cfvs.length > 0) {
      const rows = cfvs.map((v: any) => ({
        entity_id: newId,
        entity_type: 'opportunity',
        custom_field_id: v.custom_field_id,
        value: v.value,
        organization_id: orgId,
      }));
      await supabase.from('custom_field_values').insert(rows as any);
    }
  } catch (e) {
    console.warn('[duplicateOpportunity] copy custom fields failed', e);
  }

  return created as Opportunity;
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

  // Sprint Scoring 1.2 — recalc opportunity score immediately so the card
  // updates score/grade/health in the pipeline without hard refresh.
  // Triggers will also enqueue, but this fires the calc straight away.
  try {
    const { triggerOpportunityScoreRecalc } = await import(
      '@/lib/scoring/triggerOpportunityScoreRecalc'
    );
    triggerOpportunityScoreRecalc(id);
  } catch {
    // never block the move on a score recalc failure
  }

  // Handoff latency fix — kick `process-pending-workflows` async right after
  // the stage change so stage_enter rules (close_won / duplicate / activities)
  // execute in seconds instead of waiting for the 5-min cron. Fire-and-forget:
  // the cron remains as fallback if this client-side trigger drops.
  void (async () => {
    try {
      const { processPendingWorkflows } = await import('../crm/workflow-rules');
      await processPendingWorkflows(id);
    } catch (err) {
      console.error('[advanceOpportunity] Background workflow trigger failed:', err);
    }
  })();

  return data as Opportunity;
}


export async function moveOpportunity(id: string, newStageId: string): Promise<Opportunity> {
  return advanceOpportunity(id, newStageId);
}

export async function updateOpportunityStatus(
  id: string,
  status: 'won' | 'lost'
): Promise<Opportunity> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('opportunities')
    .update({ 
      status,
      updated_at: now,
      closed_at: now, // Set closed_at for immutable close date tracking
      // Clear AI scores for closed opportunities
      opportunity_score: null,
      win_probability_ai: null,
      score_updated_at: null,
    })
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
  // Sprint Active Users SoT: bloquear atribuição para usuários inativos.
  const ASSIGN_FIELDS = ['owner_user_id', 'cs_user_id', 'pre_sales_user_id'] as const;
  const assignTargets = ASSIGN_FIELDS
    .filter((f) => updates[f] !== undefined && updates[f] !== null)
    .map((f) => updates[f] as string);
  if (assignTargets.length > 0) {
    const { data: tenantId } = await supabase.rpc('get_user_organization_id');
    if (tenantId) {
      const { data: activeRows } = await (supabase as any)
        .from('crm_active_users_view')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .in('user_id', assignTargets);
      const activeSet = new Set((activeRows || []).map((r: any) => r.user_id));
      const inactive = assignTargets.filter((u) => !activeSet.has(u));
      if (inactive.length > 0) {
        throw new Error('Não é possível atribuir registros para usuários inativos. Selecione um usuário ativo.');
      }
    }
  }

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

  // Helper to extract string from JSONB, preferring primary items
  const extractStr = (val: any, keys: string[]): string | null => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      const primary = val.find((v: any) => v && typeof v === 'object' && v.is_primary);
      return extractStr(primary || val.find(Boolean), keys);
    }
    if (typeof val === 'object') {
      for (const k of keys) {
        if (typeof val[k] === 'string') return val[k];
      }
    }
    return null;
  };

  // Map the data to match the expected format
  const mapped = {
    ...data,
    account_name: data.account?.razao_social || data.account?.nome_fantasia || null,
    contact_name: data.contact?.nome || null,
    contact_email: extractStr(data.contact?.emails, ['email', 'value', 'address']),
    contact_phone: extractStr(data.contact?.telefones, ['numero', 'phone', 'value', 'number']),
  };

  // Sprint Scoring 1.2 — fire-and-forget recalculation so the new score is
  // visible in the UI within a couple of seconds. Triggers enqueue too.
  try {
    const { triggerOpportunityScoreRecalc } = await import(
      '@/lib/scoring/triggerOpportunityScoreRecalc'
    );
    triggerOpportunityScoreRecalc(id);
  } catch {
    // never block the save on score failure
  }

  return mapped as Opportunity;
}

// Extended loss details interface
export interface LossDetailsInput {
  lossReasonId: string;
  comment: string;
  competitor?: string;
  priceFactor?: boolean;
  timingFactor?: boolean;
  featureFactor?: boolean;
  relationshipFactor?: boolean;
  lossAccountability?: string;
  isRecoverable?: string;
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
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('opportunities')
    .update({
      status: 'won',
      valor_previsto: details.finalValue,
      updated_at: now,
      closed_at: now, // Set closed_at for immutable close date tracking
      // Clear AI scores for closed opportunities
      opportunity_score: null,
      win_probability_ai: null,
      score_updated_at: null,
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
    contact_email: (() => { const arr = data.contact?.emails as any; if (!Array.isArray(arr)) return null; const p = arr.find((v: any) => v?.is_primary); const item = p || arr[0]; return typeof item === 'string' ? item : item?.value || item?.email || null; })(),
    contact_phone: (() => { const arr = data.contact?.telefones as any; if (!Array.isArray(arr)) return null; const p = arr.find((v: any) => v?.is_primary); const item = p || arr[0]; return typeof item === 'string' ? item : item?.value || item?.numero || null; })(),
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
  const now = new Date().toISOString();
    const { data, error } = await supabase
    .from('opportunities')
    .update({
      status: 'lost',
      loss_reason_id: details.lossReasonId,
      loss_comment: details.comment || null,
      loss_accountability: details.lossAccountability || null,
      is_recoverable: details.isRecoverable || null,
      updated_at: now,
      closed_at: now,
      opportunity_score: null,
      win_probability_ai: null,
      score_updated_at: null,
    })
    .eq('id', id)
    .select(`
      *,
      account:accounts(razao_social, nome_fantasia, cnpj),
      contact:contacts(nome, cargo, emails, telefones),
      loss_reason:loss_reasons!opportunities_loss_reason_id_fkey(name)
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

      // Check if a record already exists (e.g. opportunity reopened from won
      // and now being lost). If so, convert it to 'lost' instead of inserting
      // a duplicate row that would be double-counted by reporting views.
      const { data: existingRecord } = await supabase
        .from('win_loss_records')
        .select('id')
        .eq('opportunity_id', id)
        .maybeSingle();

      const lostPayload = {
        outcome: 'lost' as const,
        reason_id: details.lossReasonId,
        reason_seller: details.comment || null,
        competitor: details.competitor || null,
        price_factor: details.priceFactor || false,
        timing_factor: details.timingFactor || false,
        feature_factor: details.featureFactor || false,
        relationship_factor: details.relationshipFactor || false,
        loss_accountability: details.lossAccountability || null,
        is_recoverable: details.isRecoverable || null,
        final_value: data.valor_previsto,
        sales_cycle_days: salesCycleDays,
        recorded_by: userData?.user?.id,
        // Clear win-only fields in case this row was previously a 'won' record.
        win_reason_id: null,
        discount_percent: null,
        key_differentiator: null,
        customer_feedback: null,
      };

      let insertedRecord: { id: string } | null = null;

      if (existingRecord) {
        const { data: updated } = await supabase
          .from('win_loss_records')
          .update(lostPayload)
          .eq('id', existingRecord.id)
          .select('id')
          .single();
        insertedRecord = updated ?? { id: existingRecord.id };
      } else {
        const { data: inserted } = await supabase
          .from('win_loss_records')
          .insert({
            organization_id: orgMembership,
            opportunity_id: id,
            ...lostPayload,
          })
          .select('id')
          .single();
        insertedRecord = inserted ?? null;
      }

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
    contact_email: (() => { const arr = data.contact?.emails as any; if (!Array.isArray(arr)) return null; const p = arr.find((v: any) => v?.is_primary); const item = p || arr[0]; return typeof item === 'string' ? item : item?.value || item?.email || null; })(),
    contact_phone: (() => { const arr = data.contact?.telefones as any; if (!Array.isArray(arr)) return null; const p = arr.find((v: any) => v?.is_primary); const item = p || arr[0]; return typeof item === 'string' ? item : item?.value || item?.numero || null; })(),
    loss_reason_name: data.loss_reason?.name || null,
  };

  return mapped as Opportunity;
}

// Delete opportunity (soft delete via trigger)
export async function deleteOpportunity(id: string): Promise<void> {
  // Collect browser context for audit trail
  const auditContext = collectAuditContext();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error('User not authenticated');

  // First, remove references from opportunities that were duplicated from this one
  const { error: unlinkError } = await supabase
    .from('opportunities')
    .update({ source_opportunity_id: null })
    .eq('source_opportunity_id', id);

  if (unlinkError) {
    console.error('Error unlinking child opportunities:', unlinkError);
    // Continue anyway - the main delete will fail if there's still a constraint
  }

  // Get opportunity data before deletion for audit log
  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('id, title, organization_id, deleted_at')
    .eq('id', id)
    .maybeSingle();

  if (oppError) throw new Error(oppError.message);
  if (!opportunity) throw new Error('Oportunidade não encontrada');

  // Validate membership/role (avoid silent RLS failures)
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('org_role, status')
    .eq('user_id', user.id)
    .eq('organization_id', opportunity.organization_id)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (!membership || membership.status !== 'active') {
    throw new Error('Você não está ativo nesta organização.');
  }

  // Delete will be intercepted by soft_delete_opportunity trigger
  const { error: deleteError } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Error deleting opportunity:', deleteError);
    throw new Error(deleteError.message);
  }

  // Verify soft delete actually happened (RLS can return 204 with no-op)
  const { data: after, error: afterError } = await supabase
    .from('opportunities')
    .select('id, deleted_at')
    .eq('id', id)
    .maybeSingle();

  if (afterError) throw new Error(afterError.message);

  if (after && !after.deleted_at) {
    throw new Error(
      `Você não tem permissão para excluir esta oportunidade (papel: ${membership.org_role ?? 'desconhecido'}).`
    );
  }

  // Log enhanced audit entry with client context
  if (opportunity?.organization_id) {
    try {
      const clientContext = collectAuditContext();
      const metadataPayload = JSON.parse(
        JSON.stringify({
          opportunity_title: opportunity.title,
          user_agent: clientContext.user_agent,
          referrer: clientContext.referrer,
          page_url: clientContext.page_url,
          screen_resolution: clientContext.screen_resolution,
          timezone: clientContext.timezone,
          client_timestamp: clientContext.client_timestamp,
          deletion_source: 'manual_ui',
          audit_context: auditContext,
        })
      );

      await supabase.from('audit_log').insert([
        {
          organization_id: opportunity.organization_id,
          actor_user_id: user.id,
          action: 'opportunity_deleted',
          entity_type: 'opportunity',
          entity_id: id,
          metadata: metadataPayload,
        },
      ]);
    } catch (auditError) {
      console.error('Error logging enhanced audit:', auditError);
      // Don't throw - deletion was successful
    }
  }
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

// Reopen a won/lost opportunity
export interface ReopenOpportunityInput {
  reason: string;
  targetStageId?: string;
}

export async function reopenOpportunity(
  id: string,
  input: ReopenOpportunityInput
): Promise<Opportunity> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // 1. Validate opportunity exists and is closed
  const { data: opportunity, error: fetchError } = await supabase
    .from('opportunities')
    .select('*, pipeline:pipelines(id, name)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError || !opportunity) {
    throw new Error('Oportunidade não encontrada');
  }

  if (opportunity.status !== 'won' && opportunity.status !== 'lost') {
    throw new Error('Apenas oportunidades ganhas ou perdidas podem ser reabertas');
  }

  const previousStatus = opportunity.status;

  // 2. Determine target stage if not provided
  let targetStageId = input.targetStageId;
  if (!targetStageId) {
    // Find the stage before "Ganhamos" (order_index - 1)
    const { data: stages } = await supabase
      .from('stages')
      .select('id, name, order_index')
      .eq('pipeline_id', opportunity.pipeline_id)
      .order('order_index', { ascending: false });

    if (stages && stages.length > 0) {
      // Find a stage that isn't the "won" stage (usually last one)
      const targetStage = stages.find(s => 
        s.order_index < (stages[0]?.order_index || 0)
      ) || stages[stages.length - 1];
      targetStageId = targetStage.id;
    }
  }

  if (!targetStageId) {
    throw new Error('Não foi possível determinar a etapa de destino');
  }

  const now = new Date().toISOString();

  // 3. Update opportunity: reopen it.
  // The close event is being reverted, so closed_at / won_at / lost_at MUST be
  // cleared. Otherwise dashboards, forecast, win-rate and OTE keep counting the
  // deal as closed in the original period. The audit_log entry below preserves
  // the historical timestamps for traceability. If the opportunity is later
  // re-closed (won or lost), markOpportunityAsWon/Lost will set fresh values.
  const { data: updatedOpp, error: updateError } = await supabase
    .from('opportunities')
    .update({
      status: 'open',
      stage_id: targetStageId,
      updated_at: now,
      closed_at: null,
      loss_reason_id: null,
      loss_comment: null,
      loss_accountability: null,
      is_recoverable: null,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('Error reopening opportunity:', updateError);
    throw new Error('Erro ao reabrir oportunidade');
  }

  // 4. A won opportunity reopened because the client cancelled must make the
  //    previously accepted proposal terminal as rejected/cancelled, not sent.
  const { error: proposalError } = await supabase
    .from('proposals')
    .update({
      status: 'rejected',
      declined_at: now,
      declined_reason: `Cliente cancelou após aprovação. Motivo: ${input.reason}`,
      signature_status: 'declined',
    })
    .eq('opportunity_id', id)
    .eq('status', 'accepted');

  if (proposalError) {
    console.warn('Error reopening proposals:', proposalError);
    // Don't throw - opportunity was already reopened
  }

  // 5. Delete the previous win_loss_records entry. The close event is being
  //    reverted, so dashboards/forecast/Win-Loss Hub/OTE must stop counting it.
  //    A new record will be created when the opportunity is re-closed (won/lost).
  //    The audit_log entry below preserves the original outcome for traceability.
  const { error: winLossError } = await supabase
    .from('win_loss_records')
    .delete()
    .eq('opportunity_id', id);

  if (winLossError) {
    console.warn('Error deleting win_loss_record on reopen:', winLossError);
  }

  // 6. Log audit entry
  try {
    await supabase.from('audit_log').insert({
      organization_id: opportunity.organization_id,
      actor_user_id: user.id,
      action: 'opportunity_reopened',
      entity_type: 'opportunity',
      entity_id: id,
      old_value: { status: previousStatus },
      new_value: { status: 'open', stage_id: targetStageId },
      metadata: {
        reason: input.reason,
        previous_status: previousStatus,
        target_stage_id: targetStageId,
      },
    });
  } catch (auditError) {
    console.warn('Error logging audit:', auditError);
  }

  return updatedOpp as Opportunity;
}
