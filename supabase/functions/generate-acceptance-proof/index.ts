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
    }: AcceptanceProofRequest = await req.json();

    console.log("Generating acceptance proof for proposal:", proposalId);

    // Get proposal details
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("proposals")
      .select(`
        *,
        opportunity:opportunities(
          title,
          account:accounts(razao_social, cnpj)
        ),
        organization:organizations(name, legal_name, cnpj, email)
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
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
      throw new Error("Failed to update proposal");
    }

    // Generate acceptance proof HTML
    const proofHTML = generateAcceptanceProofHTML({
      proposal,
      acceptorName,
      acceptorDocument,
      acceptorPosition,
      acceptorIp,
      acceptorUserAgent,
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
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #333;
      margin: 0;
      font-size: 24px;
    }
    .section {
      margin: 25px 0;
    }
    .section h2 {
      color: #555;
      font-size: 18px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-label {
      font-weight: bold;
      color: #666;
    }
    .info-value {
      color: #333;
    }
    .hash-box {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #ddd;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .seal {
      background: #4CAF50;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      text-align: center;
      font-weight: bold;
      margin: 20px 0;
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
      <h2>Dados da Proposta</h2>
      <div class="info-row">
        <span class="info-label">Número da Proposta:</span>
        <span class="info-value">${proposal.proposal_number || "N/A"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Título:</span>
        <span class="info-value">${proposal.title}</span>
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
      <h2>Dados do Aceite</h2>
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

    <div class="section">
      <h2>Hash de Verificação (SHA-256)</h2>
      <p style="color: #666; font-size: 14px;">Este hash garante a autenticidade e integridade deste aceite:</p>
      <div class="hash-box">${acceptanceHash}</div>
    </div>

    <div class="section">
      <h2>Declaração de Aceite</h2>
      <p style="text-align: justify; line-height: 1.8;">
        Eu, <strong>${acceptorName}</strong>, portador(a) do CPF/CNPJ <strong>${acceptorDocument}</strong>, 
        no cargo de <strong>${acceptorPosition}</strong>, declaro que li, compreendi e aceito integralmente 
        os termos e condições da proposta comercial <strong>${proposal.proposal_number}</strong> 
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
  `;
}
