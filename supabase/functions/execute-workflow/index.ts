import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization: either internal secret OR valid JWT from frontend
    const internalSecret = req.headers.get('x-internal-secret');
    const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
    const authHeader = req.headers.get('authorization');
    
    const hasValidInternalSecret = expectedSecret && internalSecret && internalSecret === expectedSecret;
    
    // If no valid internal secret, check for valid JWT from frontend
    if (!hasValidInternalSecret) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[execute-workflow] Unauthorized: No valid internal secret or JWT');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Verify JWT is valid by creating client with user token
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userToken = authHeader.replace('Bearer ', '');
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${userToken}` } }
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        console.error('[execute-workflow] Unauthorized: Invalid JWT', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`[execute-workflow] Authenticated via JWT for user: ${user.id}`);
    } else {
      console.log('[execute-workflow] Authenticated via internal secret');
    }

    const { execution_id } = await req.json();

    if (!execution_id) {
      return new Response(JSON.stringify({ error: 'execution_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get execution with workflow rule
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .select('*, workflow_rules(*)')
      .eq('id', execution_id)
      .single();

    if (execError || !execution) {
      console.error('Error fetching execution:', execError);
      return new Response(JSON.stringify({ error: 'Execution not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update status to running
    await supabase
      .from('workflow_executions')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', execution_id);

    const rule = execution.workflow_rules;
    const conditions = rule.conditions || [];
    const actions = rule.actions || [];
    const actionsExecuted: any[] = [];
    let allConditionsPassed = true;

    // Fetch opportunity data if we have opportunity_id
    let opportunity = null;
    if (execution.opportunity_id) {
      const { data: opp, error: oppError } = await supabase
        .from('opportunities')
        .select('*, accounts(*), contacts(*), pipelines(name)')
        .eq('id', execution.opportunity_id)
        .single();
      if (oppError) {
        console.error('[execute-workflow] Error fetching opportunity:', oppError);
      }
      if (opp) {
        opp.account_name = opp.accounts?.razao_social || opp.accounts?.nome_fantasia || '';
        opp.pipeline_name = opp.pipelines?.name || '';
        // Fetch stage name separately (no FK relationship)
        const { data: stageData } = await supabase
          .from('stages')
          .select('name')
          .eq('id', opp.stage_id)
          .maybeSingle();
        opp.stage_name = stageData?.name || '';
      }
      opportunity = opp;
    }

    // SAFETY GUARD: For activity_completed triggers, verify opportunity is still in the expected stage
    if (execution.trigger_type === 'activity_completed' && opportunity && rule.trigger_config) {
      const expectedStageId = rule.trigger_config.stage_id;
      const expectedPipelineId = rule.trigger_config.pipeline_id;
      
      const stageMismatch = expectedStageId && opportunity.stage_id !== expectedStageId;
      const pipelineMismatch = expectedPipelineId && opportunity.pipeline_id !== expectedPipelineId;
      
      if (stageMismatch || pipelineMismatch) {
        console.log(`[execute-workflow] SKIPPING: Stage/pipeline mismatch for activity_completed. Expected stage=${expectedStageId}, got=${opportunity.stage_id}. Expected pipeline=${expectedPipelineId}, got=${opportunity.pipeline_id}`);
        
        await supabase
          .from('workflow_executions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            actions_executed: [{ skipped: true, reason: `Stage mismatch: expected ${expectedStageId}, got ${opportunity.stage_id}` }],
          })
          .eq('id', execution_id);

        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'stage_mismatch' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // For proposal_viewed trigger, resolve opportunity from proposal if needed
    if (execution.trigger_type === 'proposal_viewed' && execution.trigger_data?.proposal_id && !opportunity) {
      const { data: proposalData } = await supabase
        .from('proposals')
        .select('opportunity_id')
        .eq('id', execution.trigger_data.proposal_id)
        .single();
      
      if (proposalData?.opportunity_id) {
        const { data: opp } = await supabase
          .from('opportunities')
          .select('*, accounts(*), contacts(*), pipelines(name)')
          .eq('id', proposalData.opportunity_id)
          .single();
        if (opp) {
          opp.account_name = opp.accounts?.razao_social || opp.accounts?.nome_fantasia || '';
          opp.pipeline_name = opp.pipelines?.name || '';
          const { data: stageData } = await supabase
            .from('stages')
            .select('name')
            .eq('id', opp.stage_id)
            .maybeSingle();
          opp.stage_name = stageData?.name || '';
        }
        opportunity = opp;
      }
    }

    // Evaluate conditions
    for (const condition of conditions) {
      const { field, operator, value } = condition;
      const fieldValue = opportunity?.[field];

      let conditionPassed = false;
      switch (operator) {
        case 'equals':
          conditionPassed = fieldValue === value;
          break;
        case 'not_equals':
          conditionPassed = fieldValue !== value;
          break;
        case 'contains':
          conditionPassed = String(fieldValue || '').toLowerCase().includes(String(value).toLowerCase());
          break;
        case 'greater_than':
          conditionPassed = Number(fieldValue) > Number(value);
          break;
        case 'less_than':
          conditionPassed = Number(fieldValue) < Number(value);
          break;
        case 'is_empty':
          conditionPassed = !fieldValue || fieldValue === '';
          break;
        case 'is_not_empty':
          conditionPassed = !!fieldValue && fieldValue !== '';
          break;
        default:
          conditionPassed = true;
      }

      if (!conditionPassed) {
        allConditionsPassed = false;
        break;
      }
    }

    if (!allConditionsPassed) {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          conditions_evaluated: conditions,
          actions_executed: [{ skipped: true, reason: 'Conditions not met' }],
        })
        .eq('id', execution_id);

      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Track the last duplicated opportunity ID for subsequent actions
    let lastDuplicatedOpportunityId: string | null = null;

    // Execute actions
    for (const action of actions) {
      try {
        let result: any = { action: action.type, success: false };

        switch (action.type) {
          case 'move_stage':
            // Support both target_stage_id and stage_id in config
            const targetStageId = action.config?.target_stage_id || action.config?.stage_id;
            
            // CRITICAL FIX: If a duplication just happened, move_stage should act on the DUPLICATED opportunity
            // This enables workflows like: "Duplicate to VENDAS -> Move to Discovery stage"
            const opportunityToMove = lastDuplicatedOpportunityId || opportunity?.id;
            
            if (opportunityToMove && targetStageId) {
              const { error } = await supabase
                .from('opportunities')
                .update({ stage_id: targetStageId })
                .eq('id', opportunityToMove);
              result = { 
                action: 'move_stage', 
                success: !error, 
                target_stage_id: targetStageId,
                opportunity_id: opportunityToMove,
                was_duplicated: !!lastDuplicatedOpportunityId
              };
              if (error) {
                console.error('[execute-workflow] Error moving stage:', error);
              } else {
                console.log(`[execute-workflow] Moved opportunity ${opportunityToMove} to stage ${targetStageId}${lastDuplicatedOpportunityId ? ' (duplicated opp)' : ''}`);
              }
            } else {
              console.error('[execute-workflow] move_stage failed: no opportunity or target stage', { opportunityToMove, targetStageId });
            }
            break;

          case 'move_next_stage':
          case 'move_previous_stage':
            // V2: Move to next/previous stage based on order_index
            const oppToMoveRelative = lastDuplicatedOpportunityId || opportunity?.id;
            
            if (oppToMoveRelative) {
              // Get current opportunity to find its stage
              const { data: currentOpp } = await supabase
                .from('opportunities')
                .select('stage_id, pipeline_id')
                .eq('id', oppToMoveRelative)
                .single();
              
              if (currentOpp?.stage_id && currentOpp?.pipeline_id) {
                // Get current stage order_index
                const { data: currentStage } = await supabase
                  .from('stages')
                  .select('order_index')
                  .eq('id', currentOpp.stage_id)
                  .single();
                
                if (currentStage) {
                  const targetOrderIndex = action.type === 'move_next_stage' 
                    ? currentStage.order_index + 1 
                    : currentStage.order_index - 1;
                  
                  // Find stage with target order_index in same pipeline
                  const { data: targetStage } = await supabase
                    .from('stages')
                    .select('id, name')
                    .eq('pipeline_id', currentOpp.pipeline_id)
                    .eq('order_index', targetOrderIndex)
                    .single();
                  
                  if (targetStage) {
                    const { error } = await supabase
                      .from('opportunities')
                      .update({ stage_id: targetStage.id })
                      .eq('id', oppToMoveRelative);
                    
                    result = { 
                      action: action.type, 
                      success: !error, 
                      target_stage_id: targetStage.id,
                      target_stage_name: targetStage.name,
                      opportunity_id: oppToMoveRelative
                    };
                    
                    if (!error) {
                      console.log(`[execute-workflow] ${action.type}: Moved opportunity ${oppToMoveRelative} to stage "${targetStage.name}"`);
                    } else {
                      console.error(`[execute-workflow] Error in ${action.type}:`, error);
                    }
                  } else {
                    result = { 
                      action: action.type, 
                      success: false, 
                      error: action.type === 'move_next_stage' ? 'Already at last stage' : 'Already at first stage'
                    };
                    console.log(`[execute-workflow] ${action.type}: No target stage found (order_index: ${targetOrderIndex})`);
                  }
                }
              }
            }
            break;

          case 'duplicate':
            if (opportunity) {
              const targetPipelineId = action.config?.target_pipeline_id || opportunity.pipeline_id;

              // P0 HOTFIX — Server-side qualification gate.
              // Pre-check before INSERT so we can log a clear skip reason.
              // The DB trigger `trg_opportunities_qualification_gate` is the
              // ultimate enforcer; this just gives us a friendlier log line.
              try {
                const { data: pipelineTarget } = await supabase
                  .from('pipelines')
                  .select('pipeline_type')
                  .eq('id', targetPipelineId)
                  .maybeSingle();
                if (pipelineTarget?.pipeline_type === 'sales') {
                  const { data: gateData, error: gateErr } = await supabase
                    .rpc('crm_check_qualification_gate', { _opportunity_id: opportunity.id });
                  if (!gateErr && gateData && (gateData as any).ok === false) {
                    console.log(`[execute-workflow] SKIPPING DUPLICATE: qualification gate blocked for source ${opportunity.id}:`, JSON.stringify((gateData as any).blockers));
                    result = {
                      action: 'duplicate',
                      success: false,
                      skipped: true,
                      reason: 'QUALIFICATION_GATE_BLOCKED',
                      blockers: (gateData as any).blockers,
                    };
                    break;
                  }
                }
              } catch (gateCheckErr) {
                console.error('[execute-workflow] Gate pre-check failed (continuing — trigger will enforce):', gateCheckErr);
              }

              // CRITICAL: Check for duplicates in target pipeline to prevent redundant duplications.
              // Canonical key = source_opportunity_id (race-safe, also enforced by partial UNIQUE INDEX
              // opportunities_no_duplicate_handoff_uidx). Also matches by title to catch legacy duplicates
              // created before source tracking. Soft-deleted rows are ignored.
              const { data: existingDuplicates, error: checkError } = await supabase
                .from('opportunities')
                .select('id, title, status, source_opportunity_id')
                .eq('organization_id', opportunity.organization_id)
                .eq('pipeline_id', targetPipelineId)
                .neq('status', 'lost')
                .is('deleted_at', null)
                .or(`source_opportunity_id.eq.${opportunity.id},title.eq.${opportunity.title.replace(/,/g, '\\,')}`);
              
              if (checkError) {
                console.error('[execute-workflow] Error checking for duplicates:', checkError);
              }
              
              // If duplicate exists in target pipeline, skip duplication
              if (existingDuplicates && existingDuplicates.length > 0) {
                console.log(`[execute-workflow] SKIPPING DUPLICATE: Opportunity "${opportunity.title}" already exists in target pipeline (${existingDuplicates.length} found)`);
                result = { 
                  action: 'duplicate', 
                  success: false, 
                  skipped: true,
                  reason: 'Duplicate already exists in target pipeline',
                  existing_ids: existingDuplicates.map(d => d.id)
                };
                break;
              }

              
              // Determine the owner for the new opportunity (SDR/CS handoff support).
              // Resilient resolution:
              //  1. Explicit user_id → validated against active sellers; falls back to round-robin if inactive/missing
              //  2. _round_robin → rotates among active Closers
              //  3. _round_robin_cs → rotates among active CS users
              //  4. Fallback: keep the source opportunity owner (never assign to deactivated users)
              let newOwnerUserId = opportunity.owner_user_id;
              const handoffTarget = action.config?.handoff_to_user_id;

              const resolveRoundRobin = async (role: string): Promise<string | null> => {
                const { data: pool } = await supabase
                  .from('sellers')
                  .select('user_id, name')
                  .eq('organization_id', opportunity.organization_id)
                  .eq('role', role)
                  .eq('active', true)
                  .order('name');

                if (!pool || pool.length === 0) {
                  console.warn(`[Handoff] No active ${role} found in organization ${opportunity.organization_id}`);
                  return null;
                }

                const targetPipelineForRR = action.config?.target_pipeline_id || opportunity.pipeline_id;
                const { data: lastAssigned } = await supabase
                  .from('opportunities')
                  .select('owner_user_id')
                  .eq('pipeline_id', targetPipelineForRR)
                  .eq('organization_id', opportunity.organization_id)
                  .is('deleted_at', null)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                const userIds = pool.map((p: any) => p.user_id);
                const lastIndex = lastAssigned ? userIds.indexOf(lastAssigned.owner_user_id) : -1;
                const nextIndex = (lastIndex + 1) % userIds.length;
                const picked = pool[nextIndex];
                console.log(`[Handoff/RoundRobin/${role}] Assigned to ${picked.name} (${picked.user_id}), index ${nextIndex}/${pool.length}`);
                return picked.user_id;
              };

              try {
                if (handoffTarget === '_round_robin') {
                  const picked = await resolveRoundRobin('Closer');
                  if (picked) newOwnerUserId = picked;
                } else if (handoffTarget === '_round_robin_cs') {
                  const picked = await resolveRoundRobin('CS');
                  if (picked) newOwnerUserId = picked;
                } else if (handoffTarget) {
                  // Validate that the explicit handoff target is an ACTIVE seller in this org.
                  const { data: targetSeller } = await supabase
                    .from('sellers')
                    .select('user_id, name, role, active')
                    .eq('organization_id', opportunity.organization_id)
                    .eq('user_id', handoffTarget)
                    .maybeSingle();

                  if (targetSeller && targetSeller.active) {
                    newOwnerUserId = handoffTarget;
                  } else {
                    // The configured user is inactive or no longer in the org.
                    // Fall back to round-robin in their role (default CS for operational handoffs), then to the original owner.
                    const fallbackRole = targetSeller?.role || 'CS';
                    console.warn(
                      `[Handoff] Configured user ${handoffTarget} is inactive/missing (role=${fallbackRole}). ` +
                      `Falling back to round-robin among active ${fallbackRole}s.`
                    );
                    const picked = await resolveRoundRobin(fallbackRole);
                    if (picked) {
                      newOwnerUserId = picked;
                    } else {
                      console.warn(
                        `[Handoff] No active ${fallbackRole} available — keeping source owner ${newOwnerUserId}. ` +
                        `Admin should update workflow rule to fix the handoff.`
                      );
                    }
                  }
                }
              } catch (handoffError) {
                console.error('[Handoff] Error resolving owner, keeping source owner:', handoffError);
              }
              
              // IMPORTANT: target_stage_id in duplicate config sets the initial stage for the NEW opportunity
              const newOpp = {
                organization_id: opportunity.organization_id,
                title: action.config?.title_prefix 
                  ? `${action.config.title_prefix}${opportunity.title}`
                  : opportunity.title,
                account_id: opportunity.account_id,
                contact_id: opportunity.contact_id,
                owner_user_id: newOwnerUserId,
                valor_previsto: opportunity.valor_previsto,
                pipeline_id: targetPipelineId,
                stage_id: action.config?.target_stage_id || opportunity.stage_id,
                status: 'new',
                source_opportunity_id: opportunity.id,
                qualified_by_user_id: opportunity.owner_user_id,
                qualified_at: new Date().toISOString(),
                prob: opportunity.prob,
                temperature: opportunity.temperature,
                produto: opportunity.produto,
                origem: opportunity.origem,
                fonte: opportunity.fonte,
                close_date_prevista: opportunity.close_date_prevista,
                mrr_value: opportunity.mrr_value,
                arr_value: opportunity.arr_value,
                commission_value: opportunity.commission_value,
                opportunity_type: opportunity.opportunity_type,
                lead_type: opportunity.lead_type,
                created_by: opportunity.created_by,
                billing_type: opportunity.billing_type,
                contract_duration: opportunity.contract_duration,
              };
              const { data, error } = await supabase
                .from('opportunities')
                .insert(newOpp)
                .select()
                .single();

              // 23505 = unique_violation. Triggered by partial UNIQUE INDEX
              // opportunities_no_duplicate_handoff_uidx when two workflow runs race.
              // Treat as skip (the other run already created the deal).
              if (error && (error as any).code === '23505') {
                console.log(`[execute-workflow] SKIPPING DUPLICATE (race): unique index blocked duplicate handoff for source ${opportunity.id} → pipeline ${targetPipelineId}`);
                result = {
                  action: 'duplicate',
                  success: false,
                  skipped: true,
                  reason: 'Duplicate blocked by unique index (concurrent run)',
                };
                break;
              }

              // P0 HOTFIX — Qualification gate trigger blocked the INSERT.
              // ERRCODE 23514 = check_violation, raised by trg_opportunities_qualification_gate.
              if (error && (
                (error as any).code === '23514'
                || String((error as any).message || '').includes('QUALIFICATION_GATE_BLOCKED')
              )) {
                console.log(`[execute-workflow] SKIPPING DUPLICATE: qualification gate (DB trigger) blocked handoff for source ${opportunity.id}: ${(error as any).message}`);
                result = {
                  action: 'duplicate',
                  success: false,
                  skipped: true,
                  reason: 'QUALIFICATION_GATE_BLOCKED',
                  detail: (error as any).message,
                };
                break;
              }


              if (data?.id) {
                lastDuplicatedOpportunityId = data.id;
                
                // ========== COPY HISTORY FROM SOURCE OPPORTUNITY ==========
                try {
                  // Get source pipeline name for handoff context
                  const { data: sourcePipeline } = await supabase
                    .from('pipelines')
                    .select('name')
                    .eq('id', opportunity.pipeline_id)
                    .single();
                  
                  // Copy all audit_log entries from source opportunity
                  const { data: sourceHistory } = await supabase
                    .from('audit_log')
                    .select('*')
                    .eq('entity_type', 'opportunity')
                    .eq('entity_id', opportunity.id);
                  
                  if (sourceHistory && sourceHistory.length > 0) {
                    const historyToInsert = sourceHistory.map((entry: any) => ({
                      organization_id: entry.organization_id,
                      actor_user_id: entry.actor_user_id,
                      action: entry.action,
                      entity_type: entry.entity_type,
                      entity_id: data.id, // Point to new opportunity
                      field_name: entry.field_name,
                      old_value: entry.old_value,
                      new_value: entry.new_value,
                      metadata: {
                        ...entry.metadata,
                        copied_from_opportunity: opportunity.id,
                        original_created_at: entry.created_at
                      },
                      created_at: entry.created_at // Keep original timestamp
                    }));
                    
                    await supabase.from('audit_log').insert(historyToInsert);
                    console.log(`[execute-workflow] Copied ${sourceHistory.length} history entries to new opportunity`);
                  }
                  
                  // Insert handoff entry
                  await supabase.from('audit_log').insert({
                    organization_id: opportunity.organization_id,
                    actor_user_id: opportunity.owner_user_id,
                    action: 'handoff_received',
                    entity_type: 'opportunity',
                    entity_id: data.id,
                    metadata: {
                      source_opportunity_id: opportunity.id,
                      source_pipeline: sourcePipeline?.name || 'Pipeline anterior',
                      handoff_by_user_id: opportunity.owner_user_id,
                      handoff_reason: 'Duplicação automática via workflow'
                    }
                  });
              console.log(`[execute-workflow] Created handoff entry for new opportunity`);
                } catch (historyError) {
                  console.error('[execute-workflow] Error copying history:', historyError);
                }

                // Copy custom field values from source to new opportunity
                try {
                  const { data: customFieldValues } = await supabase
                    .from('custom_field_values')
                    .select('*')
                    .eq('entity_id', opportunity.id)
                    .eq('entity_type', 'opportunity');

                  if (customFieldValues && customFieldValues.length > 0) {
                    const valuesToInsert = customFieldValues.map((cfv: any) => ({
                      custom_field_id: cfv.custom_field_id,
                      entity_id: data.id,
                      entity_type: 'opportunity',
                      value: cfv.value,
                      organization_id: cfv.organization_id,
                    }));

                    const { error: cfvError } = await supabase
                      .from('custom_field_values')
                      .insert(valuesToInsert);

                    if (cfvError) {
                      console.error('[execute-workflow] Error copying custom field values:', cfvError);
                    } else {
                      console.log(`[execute-workflow] Copied ${customFieldValues.length} custom field values to new opportunity`);
                    }
                  }
                } catch (cfvError) {
                  console.error('[execute-workflow] Error copying custom field values:', cfvError);
                }

                // P0 HOTFIX — Clone custom_form_values (qualification checklist)
                // from source PRE-VENDAS opp to new VENDAS opp as READ-ONLY handoff.
                // Without this, the Forms tab in Sales shows "Nenhum formulário".
                try {
                  const { data: srcFormValues } = await supabase
                    .from('custom_form_values')
                    .select('*')
                    .eq('entity_id', opportunity.id)
                    .eq('entity_type', 'opportunity');
                  if (srcFormValues?.length) {
                    const toInsert = srcFormValues.map((fv: any) => ({
                      organization_id: fv.organization_id,
                      custom_form_id: fv.custom_form_id,
                      entity_id: data.id,
                      entity_type: 'opportunity',
                      values: fv.values,
                      filled_by: fv.filled_by,
                      filled_at: fv.filled_at,
                      source_opportunity_id: opportunity.id,
                      is_readonly_handoff: true,
                    }));
                    const { error: fvErr } = await supabase
                      .from('custom_form_values')
                      .insert(toInsert);
                    if (fvErr) {
                      console.error('[execute-workflow] Error cloning custom_form_values:', fvErr);
                    } else {
                      console.log(`[execute-workflow] Cloned ${srcFormValues.length} custom_form_values (read-only handoff) to new opp ${data.id}`);
                      // Audit: checklist transferred
                      await supabase.from('audit_log').insert({
                        organization_id: opportunity.organization_id,
                        actor_user_id: opportunity.owner_user_id,
                        action: 'checklist_transferred',
                        entity_type: 'opportunity',
                        entity_id: data.id,
                        metadata: {
                          source_opportunity_id: opportunity.id,
                          forms_count: srcFormValues.length,
                          read_only: true,
                        },
                      });
                    }
                  }
                } catch (e: any) {
                  console.error('[execute-workflow] Error cloning custom_form_values:', e);
                }

                // Mark new opp as approved handoff (gate passed since INSERT succeeded).
                try {
                  await supabase
                    .from('opportunities')
                    .update({ handoff_status: 'approved' })
                    .eq('id', data.id);
                } catch (_e) { /* non-fatal */ }


                // ✅ Não clonar propostas no handoff Comercial → Operacional.
                // A proposta válida é a aprovada pelo cliente, na opp de origem.
                // Vinculamos a opp operacional via opportunities.accepted_proposal_id.
                try {
                  const { data: acceptedProposal } = await supabase
                    .from('proposals')
                    .select('id, proposal_number, accepted_at, status')
                    .eq('opportunity_id', opportunity.id)
                    .is('deleted_at', null)
                    .or('accepted_at.not.is.null,status.in.(accepted,approved,won)')
                    .order('accepted_at', { ascending: false, nullsFirst: false })
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (acceptedProposal?.id) {
                    await supabase
                      .from('opportunities')
                      .update({ accepted_proposal_id: acceptedProposal.id })
                      .eq('id', data.id);

                    await supabase.from('system_events').insert({
                      organization_id: opportunity.organization_id,
                      event_type: 'operational_handoff_proposal_link',
                      payload: {
                        source_opportunity_id: opportunity.id,
                        operational_opportunity_id: data.id,
                        accepted_proposal_id: acceptedProposal.id,
                        proposal_number: acceptedProposal.proposal_number,
                      },
                      created_by: opportunity.owner_user_id,
                    });
                    console.log(`[execute-workflow] Linked operational opp ${data.id} to accepted proposal ${acceptedProposal.id} (no clone created)`);
                  } else {
                    await supabase.from('system_events').insert({
                      organization_id: opportunity.organization_id,
                      event_type: 'operational_handoff_no_accepted_proposal',
                      payload: {
                        source_opportunity_id: opportunity.id,
                        operational_opportunity_id: data.id,
                      },
                      created_by: opportunity.owner_user_id,
                    });
                    console.warn(`[execute-workflow] Source opp ${opportunity.id} has no accepted proposal — operational opp ${data.id} created without accepted_proposal_id`);
                  }
                } catch (linkErr) {
                  console.error('[execute-workflow] Error linking accepted proposal:', linkErr);
                }

                // Copy opportunity files from source to new opportunity
                try {
                  const { data: sourceFiles } = await supabase
                    .from('opportunity_files')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);

                  if (sourceFiles && sourceFiles.length > 0) {
                    const filesToInsert = sourceFiles.map((file: any) => {
                      const { id, created_at, updated_at, ...fileData } = file;
                      return {
                        ...fileData,
                        opportunity_id: data.id,
                      };
                    });

                    const { error: filesError } = await supabase
                      .from('opportunity_files')
                      .insert(filesToInsert);

                    if (filesError) {
                      console.error('[execute-workflow] Error copying opportunity files:', filesError);
                    } else {
                      console.log(`[execute-workflow] Copied ${sourceFiles.length} files to new opportunity`);
                    }
                  }
                } catch (filesError) {
                  console.error('[execute-workflow] Error copying opportunity files:', filesError);
                }

                // Copy deal_participants from source to new opportunity
                const copyResults: Record<string, { success: boolean; count: number; error?: string }> = {};
                
                try {
                  const { data: participants } = await supabase
                    .from('deal_participants')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (participants?.length) {
                    const toInsert = participants.map((p: any) => {
                      const { id, created_at, updated_at, ...rest } = p;
                      return { ...rest, opportunity_id: data.id };
                    });
                    const { error: dpErr } = await supabase.from('deal_participants').insert(toInsert);
                    copyResults.deal_participants = dpErr 
                      ? { success: false, count: 0, error: dpErr.message }
                      : { success: true, count: participants.length };
                  }
                } catch (e: any) {
                  copyResults.deal_participants = { success: false, count: 0, error: e.message };
                }

                // Copy opportunity_tags from source to new opportunity
                try {
                  const { data: tags } = await supabase
                    .from('opportunity_tags')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (tags?.length) {
                    const toInsert = tags.map((t: any) => {
                      const { id, created_at, ...rest } = t;
                      return { ...rest, opportunity_id: data.id };
                    });
                    const { error: tagErr } = await supabase.from('opportunity_tags').insert(toInsert);
                    copyResults.opportunity_tags = tagErr
                      ? { success: false, count: 0, error: tagErr.message }
                      : { success: true, count: tags.length };
                  }
                } catch (e: any) {
                  copyResults.opportunity_tags = { success: false, count: 0, error: e.message };
                }

                // Copy contracts from source to new opportunity (reset to draft)
                try {
                  const { data: contracts } = await supabase
                    .from('contracts')
                    .select('*')
                    .eq('opportunity_id', opportunity.id)
                    .is('deleted_at', null);
                  if (contracts?.length) {
                    const toInsert = contracts.map((c: any) => {
                      const { id, created_at, updated_at, deleted_at, ...rest } = c;
                      return { ...rest, opportunity_id: data.id, status: 'draft' };
                    });
                    const { error: cErr } = await supabase.from('contracts').insert(toInsert);
                    copyResults.contracts = cErr
                      ? { success: false, count: 0, error: cErr.message }
                      : { success: true, count: contracts.length };
                  }
                } catch (e: any) {
                  copyResults.contracts = { success: false, count: 0, error: e.message };
                }

                // Copy opportunity_notes from source to new opportunity
                try {
                  const { data: notes } = await supabase
                    .from('opportunity_notes')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (notes?.length) {
                    const toInsert = notes.map((n: any) => {
                      const { id, created_at, updated_at, ...rest } = n;
                      return { ...rest, opportunity_id: data.id, created_at: n.created_at };
                    });
                    const { error: nErr } = await supabase.from('opportunity_notes').insert(toInsert);
                    copyResults.opportunity_notes = nErr
                      ? { success: false, count: 0, error: nErr.message }
                      : { success: true, count: notes.length };
                  }
                } catch (e: any) {
                  copyResults.opportunity_notes = { success: false, count: 0, error: e.message };
                }

                // Copy activities from source to new opportunity
                try {
                  const { data: acts } = await supabase
                    .from('activities')
                    .select('*')
                    .eq('opportunity_id', opportunity.id)
                    .is('deleted_at', null);
                  if (acts?.length) {
                    const toInsert = acts.map((a: any) => {
                      const { id, created_at, updated_at, deleted_at, ...rest } = a;
                      return { ...rest, opportunity_id: data.id };
                    });
                    const { error: aErr } = await supabase.from('activities').insert(toInsert);
                    copyResults.activities = aErr
                      ? { success: false, count: 0, error: aErr.message }
                      : { success: true, count: acts.length };
                  }
                } catch (e: any) {
                  copyResults.activities = { success: false, count: 0, error: e.message };
                }

                // Copy opportunity_emails from source to new opportunity
                try {
                  const { data: emails } = await supabase
                    .from('opportunity_emails')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (emails?.length) {
                    const toInsert = emails.map((e: any) => {
                      const { id, created_at, updated_at, ...rest } = e;
                      return { ...rest, opportunity_id: data.id, created_at: e.created_at };
                    });
                    const { error: eErr } = await supabase.from('opportunity_emails').insert(toInsert);
                    copyResults.opportunity_emails = eErr
                      ? { success: false, count: 0, error: eErr.message }
                      : { success: true, count: emails.length };
                  }
                } catch (e: any) {
                  copyResults.opportunity_emails = { success: false, count: 0, error: e.message };
                }

                // Copy interactions from source to new opportunity
                try {
                  const { data: interactions } = await supabase
                    .from('interactions')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (interactions?.length) {
                    const toInsert = interactions.map((i: any) => {
                      const { id, created_at, updated_at, ...rest } = i;
                      return { ...rest, opportunity_id: data.id, created_at: i.created_at };
                    });
                    const { error: iErr } = await supabase.from('interactions').insert(toInsert);
                    copyResults.interactions = iErr
                      ? { success: false, count: 0, error: iErr.message }
                      : { success: true, count: interactions.length };
                  }
                } catch (e: any) {
                  copyResults.interactions = { success: false, count: 0, error: e.message };
                }

                // Copy lead_emotional_memory from source to new opportunity
                try {
                  const { data: memories } = await supabase
                    .from('lead_emotional_memory')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (memories?.length) {
                    const toInsert = memories.map((m: any) => {
                      const { id, created_at, updated_at, ...rest } = m;
                      return { ...rest, opportunity_id: data.id };
                    });
                    const { error: mErr } = await supabase.from('lead_emotional_memory').insert(toInsert);
                    copyResults.lead_emotional_memory = mErr
                      ? { success: false, count: 0, error: mErr.message }
                      : { success: true, count: memories.length };
                  }
                } catch (e: any) {
                  copyResults.lead_emotional_memory = { success: false, count: 0, error: e.message };
                }

                // Copy vibe_alerts from source to new opportunity
                try {
                  const { data: vibes } = await supabase
                    .from('vibe_alerts')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (vibes?.length) {
                    const toInsert = vibes.map((v: any) => {
                      const { id, created_at, ...rest } = v;
                      return { ...rest, opportunity_id: data.id, created_at: v.created_at };
                    });
                    const { error: vErr } = await supabase.from('vibe_alerts').insert(toInsert);
                    copyResults.vibe_alerts = vErr
                      ? { success: false, count: 0, error: vErr.message }
                      : { success: true, count: vibes.length };
                  }
                } catch (e: any) {
                  copyResults.vibe_alerts = { success: false, count: 0, error: e.message };
                }

                // Copy opportunity_public_forms from source to new opportunity
                try {
                  const { data: forms } = await supabase
                    .from('opportunity_public_forms')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);
                  if (forms?.length) {
                    const toInsert = forms.map((f: any) => {
                      const { id, created_at, updated_at, public_token, ...rest } = f;
                      return { ...rest, opportunity_id: data.id, is_enabled: false, public_token: null };
                    });
                    const { error: fErr } = await supabase.from('opportunity_public_forms').insert(toInsert);
                    copyResults.opportunity_public_forms = fErr
                      ? { success: false, count: 0, error: fErr.message }
                      : { success: true, count: forms.length };
                  }
                } catch (e: any) {
                  copyResults.opportunity_public_forms = { success: false, count: 0, error: e.message };
                }

                // Consolidated duplication log
                const failedCopies = Object.entries(copyResults).filter(([, r]) => !r.success);
                if (failedCopies.length > 0) {
                  console.error(`[execute-workflow] WARN Duplication ${opportunity.id} -> ${data.id} had failures:`, 
                    JSON.stringify(Object.fromEntries(failedCopies)));
                }
                console.log(`[execute-workflow] OK Duplication summary ${opportunity.id} -> ${data.id}:`, 
                  JSON.stringify(copyResults));

              }
              
              result = { 
                action: 'duplicate', 
                success: !error, 
                new_opportunity_id: data?.id,
                source_opportunity_id: opportunity.id,
                qualified_by_user_id: opportunity.owner_user_id,
                target_pipeline_id: targetPipelineId,
                target_stage_id: action.config?.target_stage_id
              };
              
              console.log(`[execute-workflow] Duplicated opportunity ${opportunity.id} -> ${data?.id} (pipeline: ${targetPipelineId}, stage: ${action.config?.target_stage_id})`);
            }
            break;

          case 'close_won':
            if (opportunity) {
              const { error } = await supabase
                .from('opportunities')
                .update({ status: 'won' })
                .eq('id', opportunity.id);
              result = { action: 'close_won', success: !error };
              console.log(`[execute-workflow] Closed opportunity ${opportunity.id} as WON`);
            }
            break;

          case 'close_lost':
            if (opportunity) {
              const { error } = await supabase
                .from('opportunities')
                .update({ 
                  status: 'lost',
                  loss_reason_id: action.config?.loss_reason_id || null
                })
                .eq('id', opportunity.id);
              result = { action: 'close_lost', success: !error };
              console.log(`[execute-workflow] Closed opportunity ${opportunity.id} as LOST`);
            }
            break;

          case 'create_activity':
            // CRITICAL FIX: If a duplication just happened, create activity on the DUPLICATED opportunity
            const targetOpportunityId = lastDuplicatedOpportunityId || opportunity?.id;
            const targetOpp = lastDuplicatedOpportunityId 
              ? { id: lastDuplicatedOpportunityId, organization_id: opportunity?.organization_id, account_id: opportunity?.account_id, owner_user_id: opportunity?.owner_user_id }
              : opportunity;
            
            if (targetOpp) {
              const activityTitle = action.config?.title || 'Atividade automática';
              
              // ANTI-DUPLICATION: Check if activity with same title already exists for this opportunity
              const { data: existingActivity } = await supabase
                .from('activities')
                .select('id, created_at')
                .eq('opportunity_id', targetOpportunityId)
                .eq('title', activityTitle)
                .eq('is_automated', true)
                .eq('status', 'pending')
                .maybeSingle();
              
              if (existingActivity) {
                console.log(`[execute-workflow] SKIPPING: Activity "${activityTitle}" already exists for opportunity ${targetOpportunityId} (created at ${existingActivity.created_at})`);
                result = { 
                  action: 'create_activity', 
                  success: false, 
                  skipped: true, 
                  reason: 'Activity already exists',
                  existing_activity_id: existingActivity.id
                };
                break;
              }
              
              const scheduledDate = new Date();
              // Support both days_offset and days_from_now (used in workflow rules)
              const daysToAdd = action.config?.days_offset || action.config?.days_from_now || 0;
              scheduledDate.setDate(scheduledDate.getDate() + daysToAdd);
              
              const { data: activityData, error } = await supabase
                .from('activities')
                .insert({
                  organization_id: targetOpp.organization_id,
                  opportunity_id: targetOpportunityId,
                  account_id: targetOpp.account_id,
                  owner_user_id: targetOpp.owner_user_id,
                  type: action.config?.activity_type || 'follow_up',
                  title: activityTitle,
                  description: action.config?.description || `Criada pelo workflow: ${rule.name}`,
                  scheduled_date: scheduledDate.toISOString(),
                  status: 'pending',
                  is_automated: true,
                })
                .select()
                .single();
              
              if (error) {
                console.error('[execute-workflow] Error creating activity:', error);
                result = { action: 'create_activity', success: false, error: error.message };
              } else {
                console.log(`[execute-workflow] Created activity "${activityTitle}" for opportunity ${targetOpportunityId}${lastDuplicatedOpportunityId ? ' (duplicated opp)' : ''}`);
                result = { action: 'create_activity', success: true, activity_id: activityData?.id, opportunity_id: targetOpportunityId };
              }
            } else {
              console.error('[execute-workflow] create_activity failed: no opportunity');
              result = { action: 'create_activity', success: false, error: 'No opportunity' };
            }
            break;

          case 'update_fields':
            if (opportunity && action.config?.fields) {
              const updates: any = {};
              for (const field of action.config.fields) {
                updates[field.name] = field.value;
              }
              const { error } = await supabase
                .from('opportunities')
                .update(updates)
                .eq('id', opportunity.id);
              result = { action: 'update_fields', success: !error, fields: action.config.fields };
            }
            break;

          case 'cancel_pending_activities': {
            // Auto-cancel orphan pending activities when stage advances.
            // Soft-cancel (preserves audit trail), does NOT delete.
            const oppId = lastDuplicatedOpportunityId || opportunity?.id;
            if (oppId) {
              const scope = action.config?.scope || 'previous_stage';
              const excludeToday = action.config?.exclude_completed_today !== false;

              let cancelQuery = supabase
                .from('activities')
                .update({
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString(),
                  cancellation_reason: `stage_advanced:${rule.id}`,
                })
                .eq('opportunity_id', oppId)
                .eq('status', 'pending')
                .is('deleted_at', null);

              if (excludeToday) {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                cancelQuery = cancelQuery.lt('created_at', todayStart.toISOString());
              }

              const { data: cancelledRows, error } = await cancelQuery.select('id');
              const count = cancelledRows?.length ?? 0;

              if (error) {
                console.error('[execute-workflow] cancel_pending_activities error:', error);
                result = { action: 'cancel_pending_activities', success: false, error: error.message };
              } else {
                console.log(`[execute-workflow] Cancelled ${count} pending activities for opportunity ${oppId} (scope=${scope})`);
                result = { action: 'cancel_pending_activities', success: true, cancelled_count: count };
              }
            } else {
              result = { action: 'cancel_pending_activities', success: false, error: 'No opportunity' };
            }
            break;
          }

          case 'trigger_email_agent': {
            // Enqueue an Email Agent run for this opportunity (stage-enter / workflow-driven).
            const oppId = lastDuplicatedOpportunityId || opportunity?.id;
            const agentId = action.config?.agent_id;
            const mode = action.config?.mode || 'draft_for_review'; // 'auto_send' | 'draft_for_review'

            if (!oppId || !agentId) {
              result = { action: 'trigger_email_agent', success: false, error: 'Missing opportunity or agent_id' };
              break;
            }

            // Fetch agent + active trigger to satisfy enqueue requirements
            const { data: agent } = await supabase
              .from('ai_agents')
              .select('id, organization_id, last_published_version_id, environment, is_active, is_paused')
              .eq('id', agentId)
              .maybeSingle();

            if (!agent || !agent.last_published_version_id || agent.is_paused || !agent.is_active) {
              console.warn('[execute-workflow] trigger_email_agent: agent not eligible', { agentId, agent });
              result = { action: 'trigger_email_agent', success: false, error: 'Agent not eligible (must be active, unpaused, with published version)' };
              break;
            }

            // Idempotency: skip if a recent queued/running run already exists for this opp+agent
            const cooldownHours = action.config?.cooldown_hours ?? 6;
            const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
            const { data: existingRun } = await supabase
              .from('ai_agent_execution_runs')
              .select('id')
              .eq('agent_id', agentId)
              .eq('entity_type', 'opportunity')
              .eq('entity_id', oppId)
              .gte('created_at', cooldownCutoff)
              .in('execution_status', ['queued', 'running', 'awaiting_approval', 'executed'])
              .limit(1);

            if (existingRun && existingRun.length > 0) {
              console.log(`[execute-workflow] trigger_email_agent: skipping (recent run exists for opp ${oppId})`);
              result = { action: 'trigger_email_agent', success: false, skipped: true, reason: 'Recent run within cooldown' };
              break;
            }

            // Find an active trigger to satisfy NOT NULL trigger_id (best-effort)
            const { data: trig } = await supabase
              .from('ai_agent_triggers')
              .select('id')
              .eq('agent_version_id', agent.last_published_version_id)
              .eq('is_active', true)
              .limit(1);

            // Map workflow mode -> ai_agent_execution_runs.execution_mode
            // Constraint allows: controlled_live | approval_pending | blocked
            const executionMode = mode === 'auto_send' ? 'controlled_live' : 'approval_pending';

            const { data: runRow, error: runErr } = await supabase
              .from('ai_agent_execution_runs')
              .insert({
                organization_id: agent.organization_id,
                agent_id: agentId,
                agent_version_id: agent.last_published_version_id,
                trigger_id: trig?.[0]?.id ?? null,
                entity_type: 'opportunity',
                entity_id: oppId,
                // CRITICAL: write the denormalized opportunity_id explicitly so
                // every UI surface (opportunity tabs, timeline, approvals page)
                // can find this run via a single index lookup. Do NOT rely on
                // backfill triggers or context-snapshot resolution.
                opportunity_id: oppId,
                scenario_label: `workflow_rule:${rule.id}`,
                execution_mode: executionMode,
                execution_status: 'queued',
              })
              .select('id')
              .maybeSingle();

            if (runErr) {
              console.error('[execute-workflow] trigger_email_agent insert error:', runErr);
              result = { action: 'trigger_email_agent', success: false, error: runErr.message };
              break;
            }

            console.log(`[execute-workflow] trigger_email_agent: queued run ${runRow?.id} for opp ${oppId} (mode=${mode}/${executionMode})`);

            // Fire-and-forget: dispatch executor in background so the LLM latency
            // does not block the workflow execution (previously caused HTTP 504
            // and marked the whole run as 'partial' even when everything else
            // succeeded). The run is already queued in the DB.
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const internalSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET') || '';
            const dispatchExecutor = async () => {
              try {
                const execResp = await fetch(`${supabaseUrl}/functions/v1/execute-email-agent-run`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${serviceKey}`,
                    apikey: serviceKey,
                    'x-internal-secret': internalSecret,
                  },
                  body: JSON.stringify({ run_id: runRow!.id }),
                });
                if (!execResp.ok) {
                  const body = await execResp.text().catch(() => '');
                  console.error('[execute-workflow] async execute-email-agent-run failed', execResp.status, body);
                } else {
                  console.log('[execute-workflow] async execute-email-agent-run dispatched', { runId: runRow!.id });
                }
              } catch (e) {
                console.error('[execute-workflow] async execute-email-agent-run threw', e);
              }
            };
            // @ts-ignore - EdgeRuntime is available in Supabase Edge runtime
            if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
              // @ts-ignore
              EdgeRuntime.waitUntil(dispatchExecutor());
            } else {
              // Fallback: still non-blocking
              dispatchExecutor();
            }
            console.log(`[execute-workflow] trigger_email_agent: dispatched run ${runRow?.id} in background`);

            result = {
              action: 'trigger_email_agent',
              success: true,
              run_id: runRow?.id,
              mode,
              execution_mode: executionMode,
              executor_status: 'dispatched',
            };
            break;
          }

          case 'notify_user':
            if (opportunity) {
              // Template variable interpolation
              const replaceTemplateVars = (text: string, opp: any) => {
                return text
                  .replace(/\{\{opportunity_title\}\}/g, opp.title || '')
                  .replace(/\{\{opportunity_value\}\}/g, parseFloat(opp.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
                  .replace(/\{\{opportunity_status\}\}/g, opp.status || '')
                  .replace(/\{\{owner_name\}\}/g, opp.owner_name || '')
                  .replace(/\{\{pipeline_name\}\}/g, opp.pipeline_name || '')
                  .replace(/\{\{stage_name\}\}/g, opp.stage_name || '')
                  .replace(/\{\{account_name\}\}/g, opp.account_name || '');
              };

              const rawTitle = action.config?.title || 'Notificação de Workflow';
              const rawMessage = action.config?.message || `Workflow "${rule.name}" executado`;
              const resolvedTitle = replaceTemplateVars(rawTitle, opportunity);
              const resolvedMessage = replaceTemplateVars(rawMessage, opportunity);

              // Detect celebration-worthy notifications
              const isCelebration = action.config?.celebrate === true ||
                (opportunity.status === 'won' && rawTitle.toLowerCase().includes('deal ganho'));

              const notificationType = isCelebration ? 'deal_won' : 'workflow';
              const notificationMetadata: any = {
                workflow_rule_id: rule.id,
                opportunity_id: opportunity.id,
              };

              if (isCelebration) {
                notificationMetadata.show_celebration = true;
                notificationMetadata.value = opportunity.value ? parseFloat(opportunity.value) : null;
                notificationMetadata.account_name = opportunity.account_name || null;
              }

              const { error } = await supabase
                .from('notifications')
                .insert({
                  organization_id: opportunity.organization_id,
                  user_id: action.config?.user_id || opportunity.owner_user_id,
                  type: notificationType,
                  title: resolvedTitle,
                  message: resolvedMessage,
                  metadata: notificationMetadata,
                });

              // Additive v2 enrichment path for celebration notifications (non-fatal).
              // Keeps legacy v1 behavior as source of truth in this phase.
              if (isCelebration && !error) {
                try {
                  const targetUserId = action.config?.user_id || opportunity.owner_user_id;
                  if (targetUserId) {
                    const { data: userSettings } = await supabase
                      .from('notification_settings')
                      .select('realtime_in_app_enabled, realtime_email_enabled')
                      .eq('user_id', targetUserId)
                      .maybeSingle();

                    let primaryColor: string | null = null;
                    const { data: org } = await supabase
                      .from('organizations')
                      .select('primary_color')
                      .eq('id', opportunity.organization_id)
                      .maybeSingle();
                    if (org?.primary_color) primaryColor = org.primary_color;

                    const celebrationPayload = {
                      workflow_rule_id: rule.id,
                      opportunity_id: opportunity.id,
                      seller_name: opportunity.owner_name || null,
                      value: opportunity.value ? parseFloat(opportunity.value) : null,
                      account_name: opportunity.account_name || null,
                      primary_color: primaryColor,
                      show_celebration: true,
                    };

                    const { data: evt, error: evtErr } = await supabase
                      .from('notification_events')
                      .insert({
                        event_type: notificationType,
                        entity_type: 'opportunity',
                        entity_id: opportunity.id,
                        opportunity_id: opportunity.id,
                        company_id: opportunity.account_id || null,
                        organization_id: opportunity.organization_id,
                        triggered_by_user_id: opportunity.owner_user_id || null,
                        payload: celebrationPayload,
                      })
                      .select('id')
                      .single();

                    if (evtErr) {
                      console.error('[execute-workflow] notify_user celebration event insert failed:', evtErr);
                    } else {
                      const { error: v2Err } = await supabase
                        .from('notifications_v2')
                        .insert({
                          user_id: targetUserId,
                          event_id: evt.id,
                          type: notificationType,
                          title: resolvedTitle,
                          message: resolvedMessage,
                          priority: 'high',
                          channel_in_app: userSettings?.realtime_in_app_enabled ?? true,
                          channel_email: userSettings?.realtime_email_enabled ?? false,
                          channel_push: false,
                          status: 'pending',
                          action_url: `/app/opportunities/${opportunity.id}`,
                        });

                      if (v2Err) {
                        console.error('[execute-workflow] notify_user celebration notifications_v2 insert failed:', v2Err);
                      }
                    }
                  }
                } catch (v2Err) {
                  console.error('[execute-workflow] notify_user non-fatal v2 celebration enrichment error:', v2Err);
                }
              }
              result = { action: 'notify_user', success: !error };
            }
            break;

          default:
            result = { action: action.type, success: false, error: 'Unknown action type' };
        }

        actionsExecuted.push(result);
      } catch (actionError) {
        actionsExecuted.push({ action: action.type, success: false, error: String(actionError) });
      }
    }

    // Update execution as completed
    const allSuccess = actionsExecuted.every(a => a.success || a.skipped);
    const { error: updateError } = await supabase
      .from('workflow_executions')
      .update({
        status: allSuccess ? 'completed' : 'partial',
        completed_at: new Date().toISOString(),
        conditions_evaluated: conditions,
        actions_executed: actionsExecuted,
      })
      .eq('id', execution_id);
    
    if (updateError) {
      console.error(`[execute-workflow] CRITICAL: Failed to update execution ${execution_id} status:`, updateError);
    } else {
      console.log(`[execute-workflow] Successfully marked execution ${execution_id} as ${allSuccess ? 'completed' : 'partial'}`);
    }

    // Update workflow rule stats
    await supabase
      .from('workflow_rules')
      .update({
        executions_count: (rule.executions_count || 0) + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', rule.id);

    console.log(`[execute-workflow] Workflow "${rule.name}" executed:`, actionsExecuted);

    return new Response(JSON.stringify({ success: true, actions_executed: actionsExecuted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Workflow execution error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
