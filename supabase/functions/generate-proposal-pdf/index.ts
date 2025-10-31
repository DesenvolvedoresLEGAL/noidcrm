import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposalId } = await req.json();

    if (!proposalId) {
      throw new Error('proposalId is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch proposal with all related data
    const { data: proposal, error: proposalError } = await supabaseClient
      .from('proposals')
      .select(`
        *,
        opportunity:opportunities(
          *,
          account:accounts(*),
          contact:contacts(*)
        ),
        organization:organizations(*)
      `)
      .eq('id', proposalId)
      .single();

    if (proposalError) throw proposalError;

    // Generate HTML for the proposal
    const html = generateProposalHTML(proposal);

    // For now, we'll store the HTML as a simple text file
    // In a production environment, you'd use a proper PDF generation library
    const fileName = `${proposal.organization_id}/${proposalId}.html`;
    
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('proposal-pdfs')
      .upload(fileName, new Blob([html], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('proposal-pdfs')
      .getPublicUrl(fileName);

    // Update proposal with PDF URL
    const { error: updateError } = await supabaseClient
      .from('proposals')
      .update({ pdf_url: publicUrl })
      .eq('id', proposalId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, pdfUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating proposal PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateProposalHTML(proposal: any): string {
  const org = proposal.organization;
  const opp = proposal.opportunity;
  const account = opp?.account;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta - ${proposal.title || 'Sem título'}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid ${org.primary_color || '#000'};
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .header h1 {
      color: ${org.primary_color || '#000'};
      margin: 0;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: ${org.primary_color || '#000'};
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 10px;
      margin: 20px 0;
    }
    .info-label {
      font-weight: bold;
      color: #666;
    }
    .value-highlight {
      font-size: 2em;
      color: ${org.primary_color || '#000'};
      font-weight: bold;
      text-align: center;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${org.name}</h1>
    <p>${org.email || ''} | ${org.phone || ''}</p>
    ${org.website ? `<p>${org.website}</p>` : ''}
  </div>

  <div class="section">
    <h2>Proposta Comercial</h2>
    <div class="info-grid">
      <span class="info-label">Proposta:</span>
      <span>${proposal.title || 'Sem título'}</span>
      
      <span class="info-label">Data:</span>
      <span>${new Date(proposal.created_at).toLocaleDateString('pt-BR')}</span>
      
      <span class="info-label">Cliente:</span>
      <span>${proposal.client_name || account?.razao_social || 'N/A'}</span>
      
      ${proposal.expires_at ? `
        <span class="info-label">Validade:</span>
        <span>Até ${new Date(proposal.expires_at).toLocaleDateString('pt-BR')}</span>
      ` : ''}
    </div>
  </div>

  ${proposal.value ? `
    <div class="value-highlight">
      R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(proposal.value)}
    </div>
  ` : ''}

  ${proposal.content?.description ? `
    <div class="section">
      <h2>Descrição</h2>
      <p>${proposal.content.description}</p>
    </div>
  ` : ''}

  ${proposal.content?.terms ? `
    <div class="section">
      <h2>Termos e Condições</h2>
      <p>${proposal.content.terms}</p>
    </div>
  ` : ''}

  ${proposal.content?.notes ? `
    <div class="section">
      <h2>Observações</h2>
      <p>${proposal.content.notes}</p>
    </div>
  ` : ''}

  <div class="footer">
    <p>Este documento foi gerado automaticamente em ${new Date().toLocaleString('pt-BR')}</p>
    <p>${org.name} - ${org.legal_name || ''}</p>
    ${org.cnpj ? `<p>CNPJ: ${org.cnpj}</p>` : ''}
  </div>
</body>
</html>
  `;
}
