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
    }: AcceptanceProofRequest = await req.json();

    console.log("Generating acceptance proof for proposal:", proposalId);

    // Get proposal details with opportunity and pipeline info
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

    // ========== POST-ACCEPTANCE AUTOMATIONS ==========
    const opportunity = proposal.opportunity;
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

        // 2. Look for a CS/Onboarding pipeline to duplicate to
        const { data: csPipelines } = await supabaseClient
          .from("pipelines")
          .select("id, name, pipeline_type")
          .eq("organization_id", proposal.organization_id)
          .or("pipeline_type.eq.onboarding,name.ilike.%cs%,name.ilike.%onboarding%,name.ilike.%pós%")
          .limit(1);

        let newCsOpportunityId = null;

        if (csPipelines && csPipelines.length > 0) {
          const csPipeline = csPipelines[0];
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
            // Duplicate opportunity to CS pipeline
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
              })
              .select()
              .single();

            if (!dupError && newOpp) {
              newCsOpportunityId = newOpp.id;
              console.log("Duplicated opportunity to CS pipeline:", newOpp.id, "in stage:", targetStage.name);

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
                      discount_percent: item.discount_percent,
                      subtotal: item.subtotal,
                      total: item.total,
                      order_index: item.order_index,
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
                      installments: term.installments,
                      first_due_date: term.first_due_date,
                      entry_percent: term.entry_percent,
                      discount_percent: term.discount_percent,
                      monthly_value: term.monthly_value,
                      total_value: term.total_value,
                      comments: term.comments,
                      order_index: term.order_index,
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

        // 3. Create a contract from the proposal
        let contractId = null;
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

        // 4.1 Notify the opportunity owner (seller)
        if (opportunity.owner_user_id) {
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

        // 4.2 Notify the seller's manager (team leader)
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

        // 4.3 Notify stakeholders by org_role: owner, admin, finance, cs
        const { data: stakeholders } = await supabaseClient
          .from("organization_members")
          .select("user_id, org_role")
          .eq("organization_id", proposal.organization_id)
          .eq("status", "active")
          .in("org_role", ['owner', 'admin', 'finance', 'cs']);

        for (const stakeholder of stakeholders || []) {
          if (notifiedUsers.has(stakeholder.user_id)) continue;
          notifiedUsers.add(stakeholder.user_id);
          
          const roleTitles: Record<string, string> = {
            owner: '👑 Negócio fechado na sua organização!',
            admin: '👑 Negócio fechado na sua organização!',
            finance: '💰 Novo contrato para faturamento!',
            cs: '🤝 Nova conta para onboarding!',
          };
          
          const roleTypes: Record<string, string> = {
            owner: 'deal_won',
            admin: 'deal_won',
            finance: 'new_contract',
            cs: 'new_onboarding',
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

        console.log("Total notifications sent:", notifiedUsers.size);

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
