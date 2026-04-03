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
              
              // CRITICAL: Check if duplicate already exists in target pipeline to prevent redundant duplications
              const { data: existingDuplicates, error: checkError } = await supabase
                .from('opportunities')
                .select('id, title, status')
                .eq('organization_id', opportunity.organization_id)
                .eq('title', opportunity.title)
                .eq('pipeline_id', targetPipelineId)
                .neq('status', 'lost');
              
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
              
              // Determine the owner for the new opportunity (SDR handoff support)
              let newOwnerUserId = opportunity.owner_user_id;
              if (action.config?.handoff_to_user_id === '_round_robin') {
                // Round Robin: rotate among active Closers in the organization
                try {
                  const { data: closers } = await supabase
                    .from('sellers')
                    .select('user_id, name')
                    .eq('organization_id', opportunity.organization_id)
                    .eq('role', 'Closer')
                    .eq('active', true)
                    .order('name');
                  
                  if (closers && closers.length > 0) {
                    // Find the last assigned closer by checking most recent duplicate in this pipeline
                    const targetPipelineForRR = action.config?.target_pipeline_id || opportunity.pipeline_id;
                    const { data: lastAssigned } = await supabase
                      .from('opportunities')
                      .select('owner_user_id')
                      .eq('pipeline_id', targetPipelineForRR)
                      .eq('organization_id', opportunity.organization_id)
                      .is('deleted_at', null)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single();
                    
                    const closerUserIds = closers.map(c => c.user_id);
                    const lastIndex = lastAssigned 
                      ? closerUserIds.indexOf(lastAssigned.owner_user_id)
                      : -1;
                    const nextIndex = (lastIndex + 1) % closerUserIds.length;
                    newOwnerUserId = closerUserIds[nextIndex];
                    
                    console.log(`[Round Robin] Assigned to ${closers[nextIndex].name} (${newOwnerUserId}), index ${nextIndex}/${closers.length}`);
                  } else {
                    console.warn('[Round Robin] No active Closers found, keeping original owner');
                  }
                } catch (rrError) {
                  console.error('[Round Robin] Error resolving closer:', rrError);
                }
              } else if (action.config?.handoff_to_user_id) {
                newOwnerUserId = action.config.handoff_to_user_id;
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

                // Copy proposals and proposal items from source to new opportunity
                try {
                  const { data: sourceProposals } = await supabase
                    .from('proposals')
                    .select('*')
                    .eq('opportunity_id', opportunity.id);

                  if (sourceProposals && sourceProposals.length > 0) {
                    for (const proposal of sourceProposals) {
                      const { 
                        id: oldProposalId, 
                        created_at, 
                        updated_at,
                        public_token,
                        acceptance_hash,
                        proposal_number,
                        acceptor_name,
                        acceptor_document,
                        acceptor_document_masked,
                        acceptor_position,
                        acceptor_ip,
                        acceptor_user_agent,
                        acceptor_email,
                        acceptor_phone,
                        accepted_at,
                        signed_at,
                        signature_status,
                        declined_at,
                        declined_reason,
                        sent_at,
                        viewed_at,
                        views_count,
                        last_viewed_at,
                        acceptance_proof_url,
                        pdf_url,
                        ...proposalData 
                      } = proposal;
                      const { data: newProposal, error: propError } = await supabase
                        .from('proposals')
                        .insert({
                          ...proposalData,
                          opportunity_id: data.id,
                          status: 'draft',
                        })
                        .select()
                        .single();

                      if (propError) {
                        console.error('[execute-workflow] Error copying proposal:', propError);
                        continue;
                      }

                      console.log(`[execute-workflow] Copied proposal ${oldProposalId} -> ${newProposal.id}`);

                      // Copy proposal items
                      const { data: sourceItems } = await supabase
                        .from('proposal_items')
                        .select('*')
                        .eq('proposal_id', oldProposalId);

                      if (sourceItems && sourceItems.length > 0) {
                        const itemsToInsert = sourceItems.map((item: any) => {
                          const { id, created_at, updated_at, ...itemData } = item;
                          return {
                            ...itemData,
                            proposal_id: newProposal.id,
                          };
                        });

                        const { error: itemsError } = await supabase
                          .from('proposal_items')
                          .insert(itemsToInsert);

                        if (itemsError) {
                          console.error('[execute-workflow] Error copying proposal items:', itemsError);
                        } else {
                          console.log(`[execute-workflow] Copied ${sourceItems.length} items for proposal ${newProposal.id}`);
                        }
                      }

                      // Copy proposal payment terms
                      const { data: sourceTerms } = await supabase
                        .from('proposal_payment_terms')
                        .select('*')
                        .eq('proposal_id', oldProposalId);

                      if (sourceTerms && sourceTerms.length > 0) {
                        const termsToInsert = sourceTerms.map((term: any) => {
                          const { id, created_at, updated_at, ...termData } = term;
                          return {
                            ...termData,
                            proposal_id: newProposal.id,
                          };
                        });

                        const { error: termsError } = await supabase
                          .from('proposal_payment_terms')
                          .insert(termsToInsert);

                        if (termsError) {
                          console.error('[execute-workflow] Error copying payment terms:', termsError);
                        } else {
                          console.log(`[execute-workflow] Copied ${sourceTerms.length} payment terms for proposal ${newProposal.id}`);
                        }
                      }
                    }
                  }
                } catch (proposalError) {
                  console.error('[execute-workflow] Error copying proposals:', proposalError);
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
