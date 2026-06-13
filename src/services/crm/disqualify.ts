import { supabase } from '@/integrations/supabase/client';
import type { DisqualifyReasonSlug } from '@/lib/qualification/disqualifyReasons';
import { DISQUALIFY_REASON_LABEL } from '@/lib/qualification/disqualifyReasons';
import { logDisqualificationEvent } from './timeline-logger';

export interface DisqualifyParams {
  /** Stable reason key — official loss_reasons.id, framework key, or legacy slug. */
  reasonSlug: DisqualifyReasonSlug | string;
  /** Official loss_reasons.id — when present persists the FK. */
  reasonId?: string;
  /** Optional human label (used when reason comes from official/framework source). */
  reasonLabel?: string;
  /** Optional accountability bucket from the official reason. */
  reasonAccountability?: string | null;
  observation?: string;
  createRemarketing: boolean;
}


export interface DisqualifyResult {
  disqualified: true;
  duplicated: boolean;
  remarketingExisted: boolean;
  remarketingPipelineMissing: boolean;
  remarketingOpportunityId?: string;
}

/**
 * Look up an existing active remarketing opportunity duplicated from the given
 * original opportunity. Used to prevent duplicates and to drive UI banners.
 */
export async function findActiveRemarketingDuplicate(
  originalOpportunityId: string
): Promise<{ id: string; pipeline_id: string } | null> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, pipeline_id')
    .eq('source_opportunity_id', originalOpportunityId)
    .eq('remarketing_source', 'pre_sales_disqualification')
    .is('deleted_at', null)
    .in('status', ['new', 'open'])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[findActiveRemarketingDuplicate]', error);
    return null;
  }
  return (data as any) ?? null;
}

export async function disqualifyPreSalesOpportunity(
  opportunityId: string,
  params: DisqualifyParams
): Promise<DisqualifyResult> {
  const nowIso = new Date().toISOString();
  const {
    reasonSlug,
    reasonId,
    reasonLabel: providedLabel,
    reasonAccountability,
    observation,
    createRemarketing,
  } = params;

  // 1. Load opportunity + pipeline context
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select(`
      id, organization_id, pipeline_id, stage_id, account_id, contact_id,
      owner_user_id, origem, title, valor_previsto, produto,
      pipeline:pipelines(id, pipeline_type, organization_id)
    `)
    .eq('id', opportunityId)
    .single();

  if (oppErr || !opp) {
    throw new Error(oppErr?.message || 'Oportunidade não encontrada');
  }

  const pipelineType = (opp as any).pipeline?.pipeline_type;
  if (pipelineType !== 'qualification') {
    throw new Error('Desqualificação só é válida em pipelines de qualificação (PRÉ VENDAS).');
  }
  const orgId = opp.organization_id as string;

  // 2. Find "Desqualificado" stage in same pipeline
  let desqualificadoStageId: string | null = null;
  {
    const { data: stages } = await supabase
      .from('stages')
      .select('id, name, order_index')
      .eq('pipeline_id', opp.pipeline_id as string)
      .ilike('name', 'desqualificad%')
      .order('order_index', { ascending: false })
      .limit(1);
    desqualificadoStageId = stages?.[0]?.id ?? null;
    if (!desqualificadoStageId) {
      console.warn('[disqualify] Stage "Desqualificado" não encontrada — mantendo etapa atual.');
    }
  }

  // 3. Update original opportunity → lost + Desqualificado stage
  const reasonLabel =
    providedLabel ??
    DISQUALIFY_REASON_LABEL[reasonSlug as DisqualifyReasonSlug] ??
    reasonSlug;
  const lossCommentParts = [`[Desqualificação] ${reasonLabel}`];
  if (observation?.trim()) lossCommentParts.push(observation.trim());
  const lossComment = lossCommentParts.join(' — ');

  const updatePayload: Record<string, any> = {
    status: 'lost',
    qualification_loss_reason: reasonSlug,
    loss_comment: lossComment,
    loss_accountability: 'unknown',
    closed_at: nowIso,
    updated_at: nowIso,
    opportunity_score: null,
    win_probability_ai: null,
    score_updated_at: null,
  };
  if (desqualificadoStageId) updatePayload.stage_id = desqualificadoStageId;

  const { error: updErr } = await supabase
    .from('opportunities')
    .update(updatePayload)
    .eq('id', opportunityId);

  if (updErr) {
    console.error('[disqualify] update error', updErr);
    throw new Error(updErr.message);
  }

  // 4. Upsert win_loss_records (best effort)
  try {
    const { data: userData } = await supabase.auth.getUser();
    const { data: existingRecord } = await supabase
      .from('win_loss_records')
      .select('id')
      .eq('opportunity_id', opportunityId)
      .maybeSingle();

    const payload = {
      outcome: 'lost' as const,
      reason_id: null,
      reason_seller: lossComment,
      loss_accountability: 'unknown' as const,
      is_recoverable: 'maybe' as const,
      final_value: (opp as any).valor_previsto ?? null,
      recorded_by: userData?.user?.id,
      win_reason_id: null,
      discount_percent: null,
      key_differentiator: null,
      customer_feedback: null,
    };

    if (existingRecord) {
      await supabase.from('win_loss_records').update(payload).eq('id', existingRecord.id);
    } else {
      await supabase.from('win_loss_records').insert({
        organization_id: orgId,
        opportunity_id: opportunityId,
        ...payload,
      });
    }
  } catch (err) {
    console.error('[disqualify] win_loss_records (non-blocking)', err);
  }

  // Holds the final result so we can log once at the end.
  let result: DisqualifyResult;

  // 5. Anti-duplication check
  const existing = await findActiveRemarketingDuplicate(opportunityId);
  if (existing) {
    result = {
      disqualified: true,
      duplicated: false,
      remarketingExisted: true,
      remarketingPipelineMissing: false,
      remarketingOpportunityId: existing.id,
    };
  } else if (!createRemarketing) {
    result = {
      disqualified: true,
      duplicated: false,
      remarketingExisted: false,
      remarketingPipelineMissing: false,
    };
  } else {
    // 6. Resolve REMARKETING pipeline
    const { data: remarketingPipeline } = await supabase
      .from('pipelines')
      .select('id, organization_id')
      .eq('organization_id', orgId)
      .eq('pipeline_type', 'renewal')
      .ilike('name', '%remarketing%')
      .limit(1)
      .maybeSingle();

    const { data: firstStage } = remarketingPipeline
      ? await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', remarketingPipeline.id as string)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (!remarketingPipeline || !firstStage) {
      result = {
        disqualified: true,
        duplicated: false,
        remarketingExisted: false,
        remarketingPipelineMissing: true,
      };
    } else {
      // 7. Insert remarketing duplicate
      const remarketingReason = observation?.trim()
        ? `${reasonLabel} — ${observation.trim()}`
        : reasonLabel;

      const insertPayload: Record<string, any> = {
        organization_id: orgId,
        pipeline_id: remarketingPipeline.id,
        stage_id: firstStage.id,
        title: opp.title,
        account_id: opp.account_id,
        contact_id: opp.contact_id,
        owner_user_id: opp.owner_user_id,
        origem: (opp as any).origem ?? null,
        valor_previsto: (opp as any).valor_previsto ?? null,
        produto: (opp as any).produto ?? null,
        status: 'new',
        source_opportunity_id: opportunityId,
        remarketing_source: 'pre_sales_disqualification',
        remarketing_reason: remarketingReason,
        remarketing_status: 'pending',
        remarketing_created_at: nowIso,
      };

      const { data: inserted, error: insErr } = await supabase
        .from('opportunities')
        .insert(insertPayload as any)
        .select('id')
        .single();

      if (insErr) {
        if ((insErr as any).code === '23505') {
          const dup = await findActiveRemarketingDuplicate(opportunityId);
          result = {
            disqualified: true,
            duplicated: false,
            remarketingExisted: true,
            remarketingPipelineMissing: false,
            remarketingOpportunityId: dup?.id,
          };
        } else {
          console.error('[disqualify] insert remarketing error', insErr);
          throw new Error(insErr.message);
        }
      } else {
        // 8. Clone custom_form_values rows from original → duplicate
        try {
          const { data: formRows } = await supabase
            .from('custom_form_values')
            .select('custom_form_id, values, entity_type')
            .eq('entity_id', opportunityId);

          if (formRows && formRows.length > 0) {
            const { data: userData } = await supabase.auth.getUser();
            const clones = formRows.map((r: any) => ({
              organization_id: orgId,
              custom_form_id: r.custom_form_id,
              entity_id: inserted!.id,
              entity_type: r.entity_type,
              values: r.values,
              filled_by: userData?.user?.id ?? null,
              filled_at: nowIso,
            }));
            await supabase.from('custom_form_values').insert(clones);
          }
        } catch (err) {
          console.error('[disqualify] cloning custom_form_values (non-blocking)', err);
        }

        result = {
          disqualified: true,
          duplicated: true,
          remarketingExisted: false,
          remarketingPipelineMissing: false,
          remarketingOpportunityId: inserted!.id,
        };
      }
    }
  }

  // 9. Timeline log (non-blocking)
  try {
    await logDisqualificationEvent(opportunityId, {
      reasonSlug,
      reasonLabel,
      observation,
      remarketingCreated: result.duplicated,
      remarketingExisted: result.remarketingExisted,
      remarketingOpportunityId: result.remarketingOpportunityId,
      remarketingPipelineMissing: result.remarketingPipelineMissing,
    });
  } catch (err) {
    console.error('[disqualify] timeline log (non-blocking)', err);
  }

  return result;
}
