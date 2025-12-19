import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptanceProofRequest {
  proposalId: string;
  acceptorName: string;
  acceptorDocument: string;
  acceptorPosition: string;
  acceptorIp: string;
  acceptorUserAgent: string;
  acceptorSignature?: string;
  // Customer feedback for Win/Loss
  winReasonId?: string;
  keyDifferentiator?: string;
  customerFeedback?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const {
      proposalId,
      acceptorName,
      acceptorDocument,
      acceptorPosition,
      acceptorIp,
      acceptorUserAgent,
      acceptorSignature,
      winReasonId,
      keyDifferentiator,
      customerFeedback,
    }: AcceptanceProofRequest = await req.json();

    console.log("Generating acceptance proof for proposal:", proposalId);

    // Get proposal details with opportunity and pipeline info - FETCH ALL FIELDS for duplication
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("proposals")
      .select(`
        *,
        opportunity:opportunities(
          id,
          title,
          pipeline_id,
          stage_id,
          owner_user_id,
          account_id,
          contact_id,
          valor_previsto,
          prob,
          close_date_prevista,
          produto,
          origem,
          fonte,
          temperatura,
          temperature,
          mrr_value,
          arr_value,
          urgency_score,
          qualified_by_user_id,
          engagement_score,
          opportunity_score,
          risk_score,
          velocity_score,
          win_probability_ai,
          automation_enabled,
          last_contact_date,
          scoring_factors,
          score_confidence,
          pipeline:pipelines(id, name, pipeline_type),
          account:accounts(id, razao_social, cnpj)
        ),
        organization:organizations(id, name, legal_name, cnpj, email)
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("Proposal not found:", proposalError);
      throw new Error("Proposal not found");
    }

    // Generate acceptance hash
    const acceptedAt = new Date();
    const { data: hashData } = await supabaseClient.rpc(
      "generate_acceptance_hash",
      {
        p_proposal_id: proposalId,
        p_acceptor_document: acceptorDocument,
        p_timestamp: acceptedAt.toISOString(),
      }
    );

    const acceptanceHash = hashData;
    console.log("Generated acceptance hash:", acceptanceHash);

    // Update proposal with acceptance data
    const { error: updateError } = await supabaseClient
      .from("proposals")
      .update({
        status: "accepted",
        accepted_at: acceptedAt.toISOString(),
        acceptor_name: acceptorName,
        acceptor_document: acceptorDocument,
        acceptor_position: acceptorPosition,
        acceptor_ip: acceptorIp,
        acceptor_user_agent: acceptorUserAgent,
        acceptance_hash: acceptanceHash,
      })
      .eq("id", proposalId);

    if (updateError) {
      console.error("Failed to update proposal:", updateError);
      throw new Error("Failed to update proposal");
    }

    // ========== REGISTER ACCEPTANCE IN OPPORTUNITY HISTORY ==========
    const opportunity = proposal.opportunity;
    if (opportunity) {
      try {
        await supabaseClient.from('audit_log').insert({
          organization_id: proposal.organization_id,
          actor_user_id: null, // External acceptance (no internal user)
          action: 'proposal_accepted',
          entity_type: 'opportunity',
          entity_id: opportunity.id,
          metadata: {
            proposal_id: proposalId,
            proposal_title: proposal.title,
            proposal_number: proposal.proposal_number,
            proposal_value: proposal.value || proposal.total_amount,
            acceptor_name: acceptorName,
            acceptor_document: acceptorDocument,
            acceptor_position: acceptorPosition,
            acceptor_ip: acceptorIp,
            accepted_at: acceptedAt.toISOString(),
            acceptance_hash: acceptanceHash
          }
        });
        console.log("Registered proposal acceptance in opportunity history");
      } catch (historyError) {
        console.error("Error registering acceptance in history:", historyError);
      }

      // ========== CREATE WIN/LOSS RECORD WITH CUSTOMER FEEDBACK ==========
      try {
        // Calculate sales cycle days from opportunity created_at
        const { data: oppData } = await supabaseClient
          .from("opportunities")
          .select("created_at")
          .eq("id", opportunity.id)
          .single();

        let salesCycleDays = null;
        if (oppData?.created_at) {
          const createdDate = new Date(oppData.created_at);
          const diffTime = Math.abs(acceptedAt.getTime() - createdDate.getTime());
          salesCycleDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const winLossRecord = {
          organization_id: proposal.organization_id,
          opportunity_id: opportunity.id,
          outcome: 'won',
          win_reason_id: winReasonId || null,
          key_differentiator: keyDifferentiator || null,
          customer_feedback: customerFeedback || null,
          final_value: proposal.value || proposal.total_amount || opportunity.valor_previsto,
          sales_cycle_days: salesCycleDays,
          closed_by_proposal_id: proposalId,
          recorded_by_customer: true,
          acceptor_name: acceptorName,
          acceptor_document: acceptorDocument,
          acceptor_position: acceptorPosition,
        };

        const { data: existingRecord } = await supabaseClient
          .from("win_loss_records")
          .select("id, win_reason_id, key_differentiator, customer_feedback")
          .eq("opportunity_id", opportunity.id)
          .maybeSingle();

        if (existingRecord) {
          // Update existing record with customer feedback (preserve existing values if new ones not provided)
          const updateData: Record<string, any> = {
            recorded_by_customer: true,
            acceptor_name: acceptorName,
            acceptor_document: acceptorDocument,
            acceptor_position: acceptorPosition,
          };
          if (winReasonId) updateData.win_reason_id = winReasonId;
          if (keyDifferentiator) updateData.key_differentiator = keyDifferentiator;
          if (customerFeedback) updateData.customer_feedback = customerFeedback;

          await supabaseClient
            .from("win_loss_records")
            .update(updateData)
            .eq("id", existingRecord.id);
          console.log("Updated existing win_loss_record with customer feedback");
        } else {
          // Create new win_loss_record
          await supabaseClient.from("win_loss_records").insert(winLossRecord);
          console.log("Created win_loss_record with customer feedback:", winLossRecord);
        }
      } catch (winLossError) {
        console.error("Error creating win_loss_record:", winLossError);
        // Non-critical - continue with rest of flow
      }

      // ========== AUTO-CREATE CONTACT FROM ACCEPTOR + SET AS DECISION MAKER ==========
      if (acceptorName && opportunity.account_id) {
        try {
          console.log("Checking if acceptor contact exists:", acceptorName);
          
          // 1. Check if contact already exists (by similar name in this account)
          const { data: existingContact } = await supabaseClient
            .from('contacts')
            .select('id, nome, cargo')
            .eq('account_id', opportunity.account_id)
            .eq('organization_id', proposal.organization_id)
            .ilike('nome', `%${acceptorName.split(' ')[0]}%`)
            .maybeSingle();

          let contactId = existingContact?.id;
          let contactCreated = false;

          // 2. If not exists, create new contact
          if (!contactId) {
            const { data: newContact, error: contactError } = await supabaseClient
              .from('contacts')
              .insert({
                nome: acceptorName,
                cargo: acceptorPosition || 'Aprovador de Proposta',
                account_id: opportunity.account_id,
                organization_id: proposal.organization_id,
              })
              .select()
              .single();

            if (contactError) {
              console.error("Error creating contact from acceptor:", contactError);
            } else if (newContact) {
              contactId = newContact.id;
              contactCreated = true;
              console.log("Created new contact from acceptor:", newContact.id, newContact.nome);
            }
          } else {
            console.log("Contact already exists:", existingContact?.nome, existingContact?.cargo);
          }

          // 3. Create decision_maker edge in Knowledge Graph
          if (contactId) {
            // First, get or check if nodes exist
            const { data: contactNode } = await supabaseClient
              .from('graph_nodes')
              .select('id')
              .eq('entity_id', contactId)
              .eq('node_type', 'contact')
              .maybeSingle();

            const { data: oppNode } = await supabaseClient
              .from('graph_nodes')
              .select('id')
              .eq('entity_id', opportunity.id)
              .eq('node_type', 'opportunity')
              .maybeSingle();

            if (contactNode && oppNode) {
              // Remove existing decision_maker edge if any
              await supabaseClient
                .from('graph_edges')
                .delete()
                .eq('organization_id', proposal.organization_id)
                .eq('target_entity_id', opportunity.id)
                .eq('edge_type', 'decision_maker');

              // Create decision_maker edge
              const { error: edgeError } = await supabaseClient
                .from('graph_edges')
                .insert({
                  organization_id: proposal.organization_id,
                  source_node_id: contactNode.id,
                  target_node_id: oppNode.id,
                  source_entity_id: contactId,
                  target_entity_id: opportunity.id,
                  edge_type: 'decision_maker',
                  weight: 1.0,
                  strength: 'strong',
                  interaction_count: 1,
                  metadata: {
                    set_by: 'proposal_acceptance',
                    proposal_id: proposalId,
                    acceptor_document: acceptorDocument,
                    accepted_at: acceptedAt.toISOString(),
                  }
                });

              if (edgeError) {
                console.error("Error creating decision_maker edge:", edgeError);
              } else {
                console.log("Created decision_maker edge for contact:", contactId);
              }
            } else {
              console.log("Graph nodes not found - nodes will be created on next graph build");
            }

            // Log in audit
            await supabaseClient.from('audit_log').insert({
              organization_id: proposal.organization_id,
              actor_user_id: null,
              action: contactCreated ? 'contact_auto_created' : 'decision_maker_identified',
              entity_type: 'opportunity',
              entity_id: opportunity.id,
              metadata: {
                contact_id: contactId,
                contact_name: acceptorName,
                contact_position: acceptorPosition,
                contact_created: contactCreated,
                proposal_id: proposalId,
              }
            });
          }
        } catch (contactError) {
          console.error("Error in acceptor contact creation:", contactError);
          // Non-critical - continue with rest of flow
        }
      }
    }

// ========== POST-ACCEPTANCE AUTOMATIONS ==========
    const pipeline = opportunity?.pipeline;
    
    console.log("Processing automations for pipeline:", pipeline?.name, "type:", pipeline?.pipeline_type);

    // Only process automations if this is a sales pipeline
    if (opportunity && pipeline?.pipeline_type === 'sales') {
      try {
        // 1. Move opportunity to "Ganhamos" stage and WON status
        const { data: wonStage } = await supabaseClient
          .from("stages")
          .select("id, name")
          .eq("pipeline_id", opportunity.pipeline_id)
          .ilike("name", "%ganhamos%")
          .maybeSingle();

        if (wonStage) {
          await supabaseClient
            .from("opportunities")
            .update({
              stage_id: wonStage.id,
              status: "won",
            })
            .eq("id", opportunity.id);
          
          console.log("Moved opportunity to WON stage:", wonStage.id, wonStage.name);
        } else {
          console.log("No 'Ganhamos' stage found, just updating status to won");
          await supabaseClient
            .from("opportunities")
            .update({ status: "won" })
            .eq("id", opportunity.id);
        }

        // 2. Look for Onboarding/CS pipeline to duplicate to
        // PRIORITY ORDER: pipeline_type = 'onboarding' FIRST, then fallback to name matching
        let csPipeline = null;
        
        // First try: Find pipeline with type 'onboarding' explicitly
        const { data: onboardingPipeline } = await supabaseClient
          .from("pipelines")
          .select("id, name, pipeline_type")
          .eq("organization_id", proposal.organization_id)
          .eq("pipeline_type", "onboarding")
          .limit(1)
          .maybeSingle();
        
        if (onboardingPipeline) {
          csPipeline = onboardingPipeline;
          console.log("Found ONBOARDING pipeline (priority):", csPipeline.id, csPipeline.name);
        } else {
          // Fallback: Search by name patterns (CS, Operacional)
          const { data: fallbackPipeline } = await supabaseClient
            .from("pipelines")
            .select("id, name, pipeline_type")
            .eq("organization_id", proposal.organization_id)
            .or("name.ilike.%operacional%,name.ilike.%cs%,name.ilike.%onboarding%")
            .limit(1)
            .maybeSingle();
          
          if (fallbackPipeline) {
            csPipeline = fallbackPipeline;
            console.log("Found CS pipeline (fallback by name):", csPipeline.id, csPipeline.name);
          }
        }

        let newCsOpportunityId = null;

        if (csPipeline) {
          console.log("Found CS pipeline:", csPipeline.id, csPipeline.name);
          
          // Try to find "CHECKIN" stage specifically, fallback to first stage
          let targetStage = null;
          
          const { data: checkinStage } = await supabaseClient
            .from("stages")
            .select("id, name")
            .eq("pipeline_id", csPipeline.id)
            .ilike("name", "%checkin%")
            .maybeSingle();

          if (checkinStage) {
            targetStage = checkinStage;
            console.log("Found CHECKIN stage:", checkinStage.id, checkinStage.name);
          } else {
            // Fallback to first stage by order_index
            const { data: firstStage } = await supabaseClient
              .from("stages")
              .select("id, name")
              .eq("pipeline_id", csPipeline.id)
              .order("order_index", { ascending: true })
              .limit(1)
              .single();
            
            targetStage = firstStage;
            console.log("No CHECKIN stage found, using first stage:", firstStage?.id, firstStage?.name);
          }

          if (targetStage) {
            // Duplicate opportunity to CS pipeline - COPY ALL NATIVE FIELDS
            const { data: newOpp, error: dupError } = await supabaseClient
              .from("opportunities")
              .insert({
                organization_id: proposal.organization_id,
                pipeline_id: csPipeline.id,
                stage_id: targetStage.id,
                title: `[CS] ${opportunity.title}`,
                account_id: opportunity.account_id,
                contact_id: opportunity.contact_id,
                owner_user_id: opportunity.owner_user_id,
                valor_previsto: opportunity.valor_previsto,
                status: "open",
                source_opportunity_id: opportunity.id,
                qualified_at: acceptedAt.toISOString(),
                // COPY ALL NATIVE FIELDS FROM ORIGINAL OPPORTUNITY
                prob: opportunity.prob,
                close_date_prevista: opportunity.close_date_prevista,
                produto: opportunity.produto,
                origem: opportunity.origem,
                fonte: opportunity.fonte,
                temperatura: opportunity.temperatura,
                temperature: opportunity.temperature,
                mrr_value: opportunity.mrr_value,
                arr_value: opportunity.arr_value,
                urgency_score: opportunity.urgency_score,
                qualified_by_user_id: opportunity.qualified_by_user_id,
                engagement_score: opportunity.engagement_score,
                opportunity_score: opportunity.opportunity_score,
                risk_score: opportunity.risk_score,
                velocity_score: opportunity.velocity_score,
                win_probability_ai: opportunity.win_probability_ai,
                automation_enabled: opportunity.automation_enabled,
                last_contact_date: opportunity.last_contact_date,
                scoring_factors: opportunity.scoring_factors,
                score_confidence: opportunity.score_confidence,
              })
              .select()
              .single();

            if (!dupError && newOpp) {
              newCsOpportunityId = newOpp.id;
              console.log("Duplicated opportunity to CS pipeline:", newOpp.id, "in stage:", targetStage.name);

              // ========== COPY AUDIT_LOG HISTORY FROM ORIGINAL OPPORTUNITY ==========
              try {
                const { data: originalHistory } = await supabaseClient
                  .from("audit_log")
                  .select("*")
                  .eq("entity_type", "opportunity")
                  .eq("entity_id", opportunity.id);

                if (originalHistory && originalHistory.length > 0) {
                  const copiedHistory = originalHistory.map((entry: any) => ({
                    organization_id: entry.organization_id,
                    actor_user_id: entry.actor_user_id,
                    action: entry.action,
                    entity_type: entry.entity_type,
                    entity_id: newOpp.id, // Point to new CS opportunity
                    field_name: entry.field_name,
                    old_value: entry.old_value,
                    new_value: entry.new_value,
                    metadata: {
                      ...(entry.metadata || {}),
                      copied_from_opportunity: opportunity.id,
                      original_created_at: entry.created_at,
                    },
                    trace_id: entry.trace_id,
                  }));

                  await supabaseClient.from("audit_log").insert(copiedHistory);
                  console.log(`Copied ${copiedHistory.length} history entries to CS opportunity`);
                }

                // Add handoff entry to new CS opportunity
                await supabaseClient.from("audit_log").insert({
                  organization_id: proposal.organization_id,
                  actor_user_id: null,
                  action: "handoff_received",
                  entity_type: "opportunity",
                  entity_id: newOpp.id,
                  metadata: {
                    source_opportunity_id: opportunity.id,
                    source_opportunity_title: opportunity.title,
                    source_pipeline_name: pipeline?.name,
                    acceptor_name: acceptorName,
                    proposal_id: proposalId,
                    proposal_value: proposal.value || proposal.total_amount,
                    handoff_at: acceptedAt.toISOString(),
                  },
                });
                console.log("Created handoff_received entry in CS opportunity history");
              } catch (historyError) {
                console.error("Error copying history to CS opportunity:", historyError);
              }

              // ========== COPY CUSTOM FIELD VALUES ==========
              try {
                const { data: customFieldValues } = await supabaseClient
                  .from("custom_field_values")
                  .select("*")
                  .eq("entity_id", opportunity.id)
                  .eq("entity_type", "opportunity");

                if (customFieldValues && customFieldValues.length > 0) {
                  const copiedValues = customFieldValues.map((cfv: any) => ({
                    organization_id: cfv.organization_id,
                    custom_field_id: cfv.custom_field_id,
                    entity_id: newOpp.id, // Point to new CS opportunity
                    entity_type: "opportunity",
                    value: cfv.value,
                  }));

                  const { error: cfvError } = await supabaseClient
                    .from("custom_field_values")
                    .insert(copiedValues);

                  if (cfvError) {
                    console.error("Error copying custom field values:", cfvError);
                  } else {
                    console.log(`Copied ${copiedValues.length} custom field values to CS opportunity`);
                  }
                }
              } catch (cfvError) {
                console.error("Error in custom field values copy:", cfvError);
              }

              // ========== DUPLICATE PROPOSAL + ITEMS + PAYMENT TERMS ==========
              try {
                // 2.1 Duplicate the accepted proposal to the new CS opportunity
                const { data: newProposal, error: propError } = await supabaseClient
                  .from("proposals")
                  .insert({
                    organization_id: proposal.organization_id,
                    opportunity_id: newOpp.id, // Link to new CS opportunity
                    status: 'accepted', // Keep as accepted (read-only for CS)
                    title: proposal.title,
                    client_name: proposal.client_name,
                    client_email: proposal.client_email,
                    value: proposal.value,
                    total_amount: proposal.total_amount,
                    subtotal: proposal.subtotal,
                    discount_amount: proposal.discount_amount,
                    introduction: proposal.introduction,
                    terms: proposal.terms,
                    notes: proposal.notes,
                    currency: proposal.currency,
                    layout_id: proposal.layout_id,
                    expires_at: proposal.expires_at,
                    content: proposal.content,
                    // Keep acceptance metadata
                    acceptor_name: proposal.acceptor_name || acceptorName,
                    acceptor_document: proposal.acceptor_document || acceptorDocument,
                    acceptor_position: proposal.acceptor_position || acceptorPosition,
                    accepted_at: acceptedAt.toISOString(),
                    // New number for CS reference
                    proposal_number: `CS-${proposal.proposal_number}`,
                    proposal_version: 1,
                    parent_proposal_id: proposalId, // Reference to original
                  })
                  .select()
                  .single();

                if (propError) {
                  console.error("Error duplicating proposal:", propError);
                } else if (newProposal) {
                  console.log("Duplicated proposal for CS opportunity:", newProposal.id);

                  // 2.2 Duplicate proposal items
                  const { data: items } = await supabaseClient
                    .from("proposal_items")
                    .select("*")
                    .eq("proposal_id", proposalId);

                  if (items && items.length > 0) {
                    const newItems = items.map((item: any) => ({
                      organization_id: item.organization_id,
                      proposal_id: newProposal.id,
                      product_id: item.product_id,
                      name: item.name,
                      description: item.description,
                      quantity: item.quantity,
                      unit_cost: item.unit_cost,
                      markup_percent: item.markup_percent,
                      unit_price: item.unit_price,
                      ipi_percent: item.ipi_percent,
                      discount_percent: item.discount_percent,
                      total: item.total,
                      order_index: item.order_index,
                      image_url: item.image_url,
                      characteristics: item.characteristics,
                    }));

                    const { error: itemsError } = await supabaseClient
                      .from("proposal_items")
                      .insert(newItems);

                    if (itemsError) {
                      console.error("Error duplicating proposal items:", itemsError);
                    } else {
                      console.log(`Duplicated ${items.length} proposal items`);
                    }
                  }

                  // 2.3 Duplicate payment terms
                  const { data: paymentTerms } = await supabaseClient
                    .from("proposal_payment_terms")
                    .select("*")
                    .eq("proposal_id", proposalId);

                  if (paymentTerms && paymentTerms.length > 0) {
                    const newTerms = paymentTerms.map((term: any) => ({
                      organization_id: term.organization_id,
                      proposal_id: newProposal.id,
                      payment_type: term.payment_type,
                      entry_date: term.entry_date,
                      entry_percent: term.entry_percent,
                      discount_percent: term.discount_percent,
                      installments: term.installments,
                      first_installment_date: term.first_installment_date,
                      installment_interval_days: term.installment_interval_days,
                      due_day: term.due_day,
                      first_payment_date: term.first_payment_date,
                      monthly_value: term.monthly_value,
                      contract_total: term.contract_total,
                      comments: term.comments,
                      payment_method: term.payment_method,
                      recurring_due_day: term.recurring_due_day,
                    }));

                    const { error: termsError } = await supabaseClient
                      .from("proposal_payment_terms")
                      .insert(newTerms);

                    if (termsError) {
                      console.error("Error duplicating payment terms:", termsError);
                    } else {
                      console.log(`Duplicated ${paymentTerms.length} payment terms`);
                    }
                  }
                }
              } catch (propDupError) {
                console.error("Error in proposal duplication:", propDupError);
              }

            } else if (dupError) {
              console.error("Error duplicating to CS pipeline:", dupError);
            }
          }
        }

        // 3. Create a contract from the proposal (with anti-duplication check)
        let contractId = null;
        
        // ANTI-DUPLICATION: Check if contract already exists for this opportunity
        const { data: existingContract } = await supabaseClient
          .from("contracts")
          .select("id")
          .eq("organization_id", proposal.organization_id)
          .eq("opportunity_id", opportunity.id)
          .maybeSingle();
        
        if (existingContract) {
          contractId = existingContract.id;
          console.log("Contract already exists for opportunity, reusing:", existingContract.id);
        } else {
          const { data: contract, error: contractError } = await supabaseClient
            .from("contracts")
            .insert({
              organization_id: proposal.organization_id,
              account_id: opportunity.account_id,
              contact_id: opportunity.contact_id,
              opportunity_id: opportunity.id,
              owner_user_id: opportunity.owner_user_id,
              title: `Contrato - ${proposal.title || opportunity.title}`,
              status: "active",
              contract_value: proposal.value || opportunity.valor_previsto,
              start_date: acceptedAt.toISOString(),
              terms_and_conditions: proposal.terms,
            })
            .select()
            .single();

          if (!contractError && contract) {
            contractId = contract.id;
            console.log("Created contract:", contract.id);
          } else if (contractError) {
            console.error("Error creating contract:", contractError);
          }
        }

        // ========== FETCH CELEBRATION RECIPIENTS CONFIGURATION ==========
        let celebrationRecipients = ['seller', 'manager', 'admin', 'finance', 'cs', 'operations'];
        
        try {
          const { data: orgSettings } = await supabaseClient
            .from('organization_settings')
            .select('settings')
            .eq('organization_id', proposal.organization_id)
            .single();
          
          if (orgSettings?.settings?.celebration_recipients) {
            celebrationRecipients = orgSettings.settings.celebration_recipients;
          }
          console.log("Celebration recipients configured:", celebrationRecipients);
        } catch (settingsError) {
          console.log("Using default celebration recipients");
        }

        // ========== NOTIFICATIONS FOR ALL STAKEHOLDERS ==========
        const notificationTitle = `🎉 Proposta Aceita - ${proposal.title || proposal.proposal_number}`;
        const notificationMessage = `A proposta "${proposal.title || proposal.proposal_number}" foi aceita por ${acceptorName}! Valor: R$ ${parseFloat(proposal.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        const notificationMetadata = {
          proposal_id: proposalId,
          opportunity_id: opportunity.id,
          cs_opportunity_id: newCsOpportunityId,
          contract_id: contractId,
          acceptor_name: acceptorName,
          value: proposal.value,
          account_name: opportunity.account?.razao_social,
          show_celebration: true,
        };

        const notifiedUsers = new Set<string>();

        // 4.1 Notify the opportunity owner (seller) - only if enabled
        if (celebrationRecipients.includes('seller') && opportunity.owner_user_id) {
          notifiedUsers.add(opportunity.owner_user_id);
          await supabaseClient.from("notifications").insert({
            user_id: opportunity.owner_user_id,
            organization_id: proposal.organization_id,
            type: "deal_won",
            title: "🎉 Proposta Aceita! Você fechou negócio!",
            message: notificationMessage,
            metadata: { ...notificationMetadata, role: 'seller' },
          });
          console.log("Created notification for seller:", opportunity.owner_user_id);
        }

        // 4.2 Notify the seller's manager (team leader) - only if enabled
        if (celebrationRecipients.includes('manager')) {
          const { data: sellerTeam } = await supabaseClient
            .from("team_members")
            .select("team_id")
            .eq("user_id", opportunity.owner_user_id)
            .maybeSingle();

          if (sellerTeam?.team_id) {
            const { data: managers } = await supabaseClient
              .from("team_members")
              .select("user_id")
              .eq("team_id", sellerTeam.team_id)
              .eq("role", "leader");
            
            for (const manager of managers || []) {
              if (!notifiedUsers.has(manager.user_id)) {
                notifiedUsers.add(manager.user_id);
                await supabaseClient.from("notifications").insert({
                  user_id: manager.user_id,
                  organization_id: proposal.organization_id,
                  type: "team_deal_won",
                  title: "👔 Membro do seu time fechou negócio!",
                  message: notificationMessage,
                  metadata: { ...notificationMetadata, role: 'manager' },
                });
                console.log("Created notification for manager:", manager.user_id);
              }
            }
          }
        }

        // 4.3 Notify stakeholders by org_role based on configuration
        const enabledRoles: string[] = [];
        if (celebrationRecipients.includes('admin')) {
          enabledRoles.push('owner', 'admin');
        }
        if (celebrationRecipients.includes('finance')) {
          enabledRoles.push('finance');
        }
        if (celebrationRecipients.includes('cs')) {
          enabledRoles.push('cs');
        }
        if (celebrationRecipients.includes('operations')) {
          enabledRoles.push('operations');
        }

        if (enabledRoles.length > 0) {
          const { data: stakeholders } = await supabaseClient
            .from("organization_members")
            .select("user_id, org_role")
            .eq("organization_id", proposal.organization_id)
            .eq("status", "active")
            .in("org_role", enabledRoles);

          for (const stakeholder of stakeholders || []) {
            if (notifiedUsers.has(stakeholder.user_id)) continue;
            notifiedUsers.add(stakeholder.user_id);
            
            const roleTitles: Record<string, string> = {
              owner: '👑 Negócio fechado na sua organização!',
              admin: '👑 Negócio fechado na sua organização!',
              finance: '💰 Novo contrato para faturamento!',
              cs: '🤝 Nova conta para onboarding!',
              operations: '⚙️ Novo contrato fechado!',
            };
            
            const roleTypes: Record<string, string> = {
              owner: 'deal_won',
              admin: 'deal_won',
              finance: 'new_contract',
              cs: 'new_onboarding',
              operations: 'deal_won',
            };
            
            await supabaseClient.from("notifications").insert({
              user_id: stakeholder.user_id,
              organization_id: proposal.organization_id,
              type: roleTypes[stakeholder.org_role] || 'deal_won',
              title: roleTitles[stakeholder.org_role] || notificationTitle,
              message: notificationMessage,
              metadata: { ...notificationMetadata, role: stakeholder.org_role },
            });
            console.log("Created notification for", stakeholder.org_role, ":", stakeholder.user_id);
          }
        }

        console.log("Total notifications sent:", notifiedUsers.size);

        // ========== RECALCULATE ACCOUNT SCORES ==========
        // After proposal acceptance, recalculate Lead Score (INTENT should increase)
        if (opportunity.account_id) {
          try {
            console.log("Triggering score recalculation for account:", opportunity.account_id);
            
            // Mark account for recalculation
            await supabaseClient
              .from("accounts")
              .update({ score_updated_at: null })
              .eq("id", opportunity.account_id);
            
            // Call calculate-account-scores edge function
            const supabaseUrl = Deno.env.get("SUPABASE_URL");
            const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
            
            const scoreResponse = await fetch(
              `${supabaseUrl}/functions/v1/calculate-account-scores`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ accountId: opportunity.account_id }),
              }
            );
            
            if (scoreResponse.ok) {
              const scoreResult = await scoreResponse.json();
              console.log("Score recalculation result:", scoreResult);
            } else {
              console.error("Score recalculation failed:", await scoreResponse.text());
            }
          } catch (scoreError) {
            console.error("Error recalculating scores:", scoreError);
          }
        }

      } catch (automationError) {
        // Log but don't fail the acceptance if automations fail
        console.error("Error in post-acceptance automations:", automationError);
      }
    }

    // Generate acceptance proof HTML
    const proofHTML = generateAcceptanceProofHTML({
      proposal,
      acceptorName,
      acceptorDocument,
      acceptorPosition,
      acceptorIp,
      acceptorUserAgent,
      acceptorSignature,
      acceptedAt: acceptedAt.toISOString(),
      acceptanceHash,
    });

    console.log("Acceptance proof generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        acceptanceHash,
        proofHTML,
        message: "Acceptance recorded successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error generating acceptance proof:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate acceptance proof" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateAcceptanceProofHTML(data: any): string {
  const {
    proposal,
    acceptorName,
    acceptorDocument,
    acceptorPosition,
    acceptorIp,
    acceptorUserAgent,
    acceptorSignature,
    acceptedAt,
    acceptanceHash,
  } = data;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprovante de Aceite - ${proposal.proposal_number}</title>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #4D2BFB;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1a1a2e;
      margin: 0;
      font-size: 24px;
    }
    .section {
      margin: 25px 0;
    }
    .section h2 {
      color: #4D2BFB;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label {
      font-weight: 600;
      color: #666;
    }
    .info-value {
      color: #1a1a2e;
    }
    .hash-box {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      word-break: break-all;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 11px;
      color: #666;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #888;
      font-size: 12px;
    }
    .seal {
      background: linear-gradient(135deg, #4D2BFB, #7C3AED);
      color: white;
      padding: 15px 30px;
      border-radius: 8px;
      text-align: center;
      font-weight: bold;
      margin: 20px 0;
      font-size: 18px;
    }
    .signature-box {
      text-align: center;
      padding: 30px;
      border: 2px dashed #ddd;
      border-radius: 8px;
      margin: 20px 0;
    }
    .signature {
      font-family: 'Dancing Script', cursive;
      font-size: 36px;
      color: #1a1a2e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 COMPROVANTE DE ACEITE DE PROPOSTA COMERCIAL</h1>
      <p style="color: #666; margin: 10px 0;">Documento com Validade Jurídica</p>
    </div>

    <div class="seal">✓ PROPOSTA ACEITA ELETRONICAMENTE</div>

    <div class="section">
      <h2>📄 Dados da Proposta</h2>
      <div class="info-row">
        <span class="info-label">Número da Proposta:</span>
        <span class="info-value">${proposal.proposal_number || "N/A"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Título:</span>
        <span class="info-value">${proposal.title || "Proposta Comercial"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Valor:</span>
        <span class="info-value">R$ ${parseFloat(proposal.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Empresa Fornecedora:</span>
        <span class="info-value">${proposal.organization?.legal_name || proposal.organization?.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">CNPJ Fornecedor:</span>
        <span class="info-value">${proposal.organization?.cnpj || "N/A"}</span>
      </div>
    </div>

    <div class="section">
      <h2>✍️ Dados do Signatário</h2>
      <div class="info-row">
        <span class="info-label">Nome Completo:</span>
        <span class="info-value">${acceptorName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">CPF/CNPJ:</span>
        <span class="info-value">${acceptorDocument}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cargo:</span>
        <span class="info-value">${acceptorPosition}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Data e Hora do Aceite:</span>
        <span class="info-value">${new Date(acceptedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Endereço IP:</span>
        <span class="info-value">${acceptorIp}</span>
      </div>
    </div>

    ${acceptorSignature ? `
    <div class="section">
      <h2>🖊️ Assinatura Digital</h2>
      <div class="signature-box">
        <p class="signature">${acceptorSignature}</p>
        <p style="color: #888; font-size: 12px; margin-top: 10px;">${acceptorName}</p>
      </div>
    </div>
    ` : ''}

    <div class="section">
      <h2>🔒 Hash de Verificação (SHA-256)</h2>
      <p style="color: #666; font-size: 14px;">Este hash garante a autenticidade e integridade deste aceite:</p>
      <div class="hash-box">${acceptanceHash}</div>
    </div>

    <div class="section">
      <h2>📜 Declaração de Aceite</h2>
      <p style="text-align: justify; line-height: 1.8;">
        Eu, <strong>${acceptorName}</strong>, portador(a) do CPF/CNPJ <strong>${acceptorDocument}</strong>, 
        no cargo de <strong>${acceptorPosition}</strong>, declaro que li, compreendi e aceito integralmente 
        os termos e condições da proposta comercial <strong>${proposal.proposal_number || 'N/A'}</strong> 
        apresentada por <strong>${proposal.organization?.legal_name || proposal.organization?.name}</strong>.
      </p>
      <p style="text-align: justify; line-height: 1.8;">
        Este aceite eletrônico possui plena validade jurídica conforme o artigo 10 da Medida Provisória 
        nº 2.200-2/2001 e Lei nº 14.063/2020, que tratam da assinatura eletrônica.
      </p>
    </div>

    <div class="footer">
      <p>Este documento foi gerado eletronicamente em ${new Date(acceptedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      <p>Navegador: ${acceptorUserAgent}</p>
      <p><strong>Documento verificável através do hash SHA-256</strong></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
