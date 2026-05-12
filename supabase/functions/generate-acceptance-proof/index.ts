import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveApprovedProposalAmount } from "../_shared/approved-proposal-value.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptanceProofRequest {
  proposalId: string;
  acceptorName: string;
  acceptorDocument: string;
  acceptorPhone?: string;
  acceptorEmail?: string;
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
      acceptorPhone,
      acceptorEmail,
      acceptorPosition,
      acceptorIp,
      acceptorUserAgent,
      acceptorSignature,
      winReasonId,
      keyDifferentiator,
      customerFeedback,
    }: AcceptanceProofRequest = await req.json();

    console.log("Generating acceptance proof for proposal:", proposalId);

    const { error: orchestrationError } = await supabaseClient.rpc("orchestrate_proposal_financials", {
      p_proposal_id: proposalId,
      p_reason: "generate_acceptance_proof_preflight",
    });
    if (orchestrationError) {
      console.error("[generate-acceptance-proof] Financial preflight failed:", orchestrationError);
    }

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
          account:accounts(id, razao_social, nome_fantasia, cnpj)
        ),
        organization:organizations(id, name, legal_name, cnpj, email)
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("Proposal not found:", proposalError);
      throw new Error("Proposal not found");
    }

    const acceptedAt = new Date();
    const approved = resolveApprovedProposalAmount(proposal as any);
    const approvedValue = Number((approved.amount || proposal.total_amount || proposal.value || proposal.opportunity?.valor_previsto || 0).toFixed(2));
    const approvalSnapshot = {
      proposal_id: proposalId,
      approved_at: acceptedAt.toISOString(),
      approved_amount: approvedValue,
      amount_source: approved.source,
      base_amount: approved.base_amount,
      payment_expected_amount: proposal.payment_expected_amount ?? null,
      dynamic_pricing: {
        enabled: approved.dynamic_enabled,
        status: approved.dynamic_status,
        current_amount: approved.dynamic_amount,
        current_tier_id: approved.current_tier_id,
        current_label: approved.current_tier_label,
      },
    };

    // Generate acceptance hash
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

    // Validate winReasonId is a real UUID before passing it to FK columns;
    // anything else (legacy hardcoded codes) is dropped to NULL so inserts don't fail.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeWinReasonId = winReasonId && UUID_RE.test(winReasonId) ? winReasonId : null;
    if (winReasonId && !safeWinReasonId) {
      console.warn("[acceptance] Ignoring non-UUID winReasonId:", winReasonId);
    }

    // Update proposal with acceptance data + mirror feedback fields so we never lose them
    const { error: updateError } = await supabaseClient
      .from("proposals")
      .update({
        status: "accepted",
        accepted_at: acceptedAt.toISOString(),
        acceptor_name: acceptorName,
        acceptor_document: acceptorDocument,
        acceptor_phone: acceptorPhone || null,
        acceptor_email: acceptorEmail || null,
        acceptor_position: acceptorPosition,
        acceptor_ip: acceptorIp,
        acceptor_user_agent: acceptorUserAgent,
        acceptance_hash: acceptanceHash,
        approved_amount: approvedValue,
        approval_snapshot: approvalSnapshot,
        win_reason_id: safeWinReasonId,
        key_differentiator: keyDifferentiator || null,
        customer_feedback: customerFeedback || null,
        updated_at: acceptedAt.toISOString(),
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
            proposal_value: approvedValue,
            amount_source: approved.source,
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
          win_reason_id: safeWinReasonId,
          key_differentiator: keyDifferentiator || null,
          customer_feedback: customerFeedback || null,
          final_value: approvedValue,
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
            final_value: approvedValue,
          };
          if (safeWinReasonId) updateData.win_reason_id = safeWinReasonId;
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
              valor_previsto: approvedValue,
            })
            .eq("id", opportunity.id);
          
          console.log("Moved opportunity to WON stage:", wonStage.id, wonStage.name);
        } else {
          console.log("No 'Ganhamos' stage found, just updating status to won");
          await supabaseClient
            .from("opportunities")
            .update({ status: "won", valor_previsto: approvedValue })
            .eq("id", opportunity.id);
        }

        // NOTE: CS/Onboarding opportunity duplication removed — now handled by workflow automations
        // This prevents duplicate [CS] opportunities when workflows also duplicate on opportunity_won

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
          // Fetch payment terms to calculate end_date and values
          const { data: paymentTerms } = await supabaseClient
            .from("proposal_payment_terms")
            .select("*")
            .eq("proposal_id", proposalId);

          // Find recurring and one-time terms
          const recurringTerm = paymentTerms?.find((t: any) => t.payment_type === 'recurring');
          const oneTimeTerm = paymentTerms?.find((t: any) => t.payment_type === 'one_time');

          // Calculate end_date based on contract_duration_months
          let contractEndDate: Date | null = null;
          let contractType = 'one-time';
          let monthlyValue = 0;
          let oneTimeValue = 0;
          let contractStartDate = acceptedAt.toISOString();

          if (recurringTerm) {
            const contractMonths = recurringTerm.contract_duration_months || recurringTerm.contract_months || 12;
            const startDate = recurringTerm.contract_start_date 
              ? new Date(recurringTerm.contract_start_date) 
              : acceptedAt;
            
            contractStartDate = startDate.toISOString();
            
            // Calculate end_date: start_date + contract_months
            contractEndDate = new Date(startDate);
            contractEndDate.setMonth(contractEndDate.getMonth() + contractMonths);
            
            monthlyValue = recurringTerm.monthly_value || 0;
            
            // Determine type based on duration
            if (contractMonths <= 1) contractType = 'monthly';
            else if (contractMonths <= 3) contractType = 'quarterly';
            else contractType = 'annual';
            
            console.log("Recurring term found:", {
              contractMonths,
              startDate: contractStartDate,
              endDate: contractEndDate?.toISOString(),
              monthlyValue,
              contractType
            });
          }

          // Calculate one-time value from proposal items
          if (oneTimeTerm || !recurringTerm) {
            const { data: oneTimeItems } = await supabaseClient
              .from("proposal_items")
              .select("total, billing_type")
              .eq("proposal_id", proposalId);
            
            oneTimeValue = oneTimeItems?.reduce((sum: number, item: any) => {
              const billingType = item.billing_type || 'one_time';
              if (billingType === 'one_time') {
                return sum + (Number(item.total) || 0);
              }
              return sum;
            }, 0) || 0;
            
            console.log("One-time value calculated:", oneTimeValue);
          }

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
              contract_value: approvedValue,
              monthly_value: monthlyValue,
              one_time_value: oneTimeValue,
              contract_type: contractType,
              start_date: contractStartDate,
              end_date: contractEndDate?.toISOString() || null,
              terms_and_conditions: proposal.terms,
            })
            .select()
            .single();

          if (!contractError && contract) {
            contractId = contract.id;
            console.log("Created contract:", contract.id, "end_date:", contractEndDate?.toISOString());
          } else if (contractError) {
            console.error("Error creating contract:", contractError);
          }
        }

        // NOTE: Notifications, celebrations, and Slack are now handled exclusively
        // by post-acceptance-effects (called from ProposalPublicView.tsx).
        // This avoids duplication and ensures reliable fan-out to all org members.
        console.log("Skipping notifications here — handled by post-acceptance-effects");

        // NOTE: Slack also handled by post-acceptance-effects

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
        <span class="info-value">R$ ${parseFloat(proposal.total_amount || proposal.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
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
