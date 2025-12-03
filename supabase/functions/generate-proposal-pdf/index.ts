import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { replaceVariables } from "./replaceVariables.ts";

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

    // Fetch proposal with all related data (without owner join - no FK exists)
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

    // Fetch owner profile separately if opportunity exists
    let ownerProfile = null;
    if (proposal.opportunity?.owner_user_id) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', proposal.opportunity.owner_user_id)
        .single();
      ownerProfile = profile;
    }

    // Fetch proposal items
    const { data: items } = await supabaseClient
      .from('proposal_items')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('order_index', { ascending: true });

    // Fetch payment terms
    const { data: paymentTerms } = await supabaseClient
      .from('proposal_payment_terms')
      .select('*')
      .eq('proposal_id', proposalId);

    // Build context for variable replacement
    const variableContext = {
      organization: proposal.organization,
      account: proposal.opportunity?.account,
      contact: proposal.opportunity?.contact,
      proposal: proposal,
      owner: ownerProfile,
    };

    // Replace variables in text fields
    const processedProposal = {
      ...proposal,
      title: replaceVariables(proposal.title || '', variableContext),
      introduction: replaceVariables(proposal.introduction || '', variableContext),
      terms: replaceVariables(proposal.terms || '', variableContext),
      notes: replaceVariables(proposal.notes || '', variableContext),
    };

    // Generate HTML for the proposal
    const html = generateProposalHTML(processedProposal, items || [], paymentTerms || []);

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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateProposalHTML(proposal: any, items: any[], paymentTerms: any[]): string {
  const org = proposal.organization;
  const opp = proposal.opportunity;
  const account = opp?.account;
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  
  // Format rich text (basic markdown-like rendering)
  const formatRichText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  // Calculate installments for payment terms
  const calculateInstallments = (term: any) => {
    if (term.payment_type !== 'one_time') return [];
    
    const installments = [];
    const discountedTotal = total * (1 - (term.discount_percent || 0) / 100);
    const entryAmount = discountedTotal * ((term.entry_percent || 0) / 100);
    
    if (entryAmount > 0) {
      installments.push({
        type: 'Entrada',
        date: term.entry_date,
        amount: entryAmount,
      });
    }
    
    const remaining = discountedTotal - entryAmount;
    const installmentAmount = remaining / (term.installments || 1);
    
    for (let i = 0; i < (term.installments || 1); i++) {
      const date = new Date(term.first_installment_date || new Date());
      date.setDate(date.getDate() + (i * (term.installment_interval_days || 30)));
      installments.push({
        type: `Parcela ${i + 1}`,
        date: date.toISOString().split('T')[0],
        amount: installmentAmount,
      });
    }
    
    return installments;
  };
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta - ${proposal.title || 'Sem título'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 30px;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 4px solid ${org.primary_color || '#000'};
      padding-bottom: 30px;
      margin-bottom: 40px;
    }
    .logo {
      max-width: 200px;
      height: auto;
    }
    .company-info {
      text-align: right;
    }
    .company-info h1 {
      color: ${org.primary_color || '#000'};
      margin-bottom: 10px;
      font-size: 28px;
    }
    .company-info p {
      margin: 5px 0;
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section-title {
      color: ${org.primary_color || '#000'};
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 12px;
      margin-bottom: 20px;
      font-size: 22px;
      font-weight: 600;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 15px 20px;
      margin: 25px 0;
      background: #f9f9f9;
      padding: 25px;
      border-radius: 8px;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .info-value {
      color: #333;
    }
    .value-highlight {
      font-size: 36px;
      color: ${org.primary_color || '#000'};
      font-weight: bold;
      text-align: center;
      padding: 30px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border-radius: 12px;
      margin: 30px 0;
      border: 2px solid ${org.primary_color || '#000'};
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .items-table thead {
      background: ${org.primary_color || '#000'};
      color: white;
    }
    .items-table th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    .items-table td {
      padding: 15px;
      border-bottom: 1px solid #e0e0e0;
    }
    .items-table tbody tr:hover {
      background: #f9f9f9;
    }
    .item-name {
      font-weight: 600;
      color: #333;
    }
    .item-desc {
      color: #666;
      font-size: 13px;
      margin-top: 5px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .totals-section {
      margin-top: 30px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-box {
      width: 350px;
      background: #f9f9f9;
      padding: 25px;
      border-radius: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .total-row.grand {
      font-size: 20px;
      font-weight: bold;
      color: ${org.primary_color || '#000'};
      border-top: 3px solid ${org.primary_color || '#000'};
      border-bottom: none;
      margin-top: 10px;
      padding-top: 15px;
    }
    .content {
      line-height: 1.8;
      color: #444;
      margin: 20px 0;
    }
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .payment-table th,
    .payment-table td {
      padding: 12px;
      border: 1px solid #e0e0e0;
      text-align: left;
    }
    .payment-table th {
      background: #f5f5f5;
      font-weight: 600;
    }
    .footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 3px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 13px;
    }
    .footer p {
      margin: 8px 0;
    }
    @media print {
      body {
        padding: 20px;
      }
      .items-table {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${org.logo_url ? `<img src="${org.logo_url}" alt="${org.name}" class="logo" />` : ''}
    </div>
    <div class="company-info">
      <h1>${org.name}</h1>
      ${org.cnpj ? `<p><strong>CNPJ:</strong> ${org.cnpj}</p>` : ''}
      ${org.email ? `<p><strong>Email:</strong> ${org.email}</p>` : ''}
      ${org.phone ? `<p><strong>Telefone:</strong> ${org.phone}</p>` : ''}
      ${org.website ? `<p><strong>Site:</strong> ${org.website}</p>` : ''}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Proposta Comercial</h2>
    <div class="info-grid">
      <span class="info-label">Proposta Nº:</span>
      <span class="info-value">${proposal.id.substring(0, 8).toUpperCase()}</span>
      
      <span class="info-label">Título:</span>
      <span class="info-value">${proposal.title || 'Sem título'}</span>
      
      <span class="info-label">Data de Emissão:</span>
      <span class="info-value">${new Date(proposal.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
      
      <span class="info-label">Cliente:</span>
      <span class="info-value">${proposal.client_name || account?.razao_social || account?.nome_fantasia || 'N/A'}</span>
      
      ${proposal.client_email ? `
        <span class="info-label">Email:</span>
        <span class="info-value">${proposal.client_email}</span>
      ` : ''}
      
      ${proposal.expires_at ? `
        <span class="info-label">Validade:</span>
        <span class="info-value">Até ${new Date(proposal.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
      ` : ''}
      
      ${proposal.version ? `
        <span class="info-label">Versão:</span>
        <span class="info-value">v${proposal.version}</span>
      ` : ''}
    </div>
  </div>

  ${proposal.introduction ? `
    <div class="section">
      <h2 class="section-title">Apresentação</h2>
      <div class="content">
        ${formatRichText(proposal.introduction)}
      </div>
    </div>
  ` : ''}

  ${items.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Itens da Proposta</h2>
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-center">Qtd</th>
            <th class="text-right">Preço Unit.</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>
                <div class="item-name">${item.name}</div>
                ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
              </td>
              <td class="text-center">${item.quantity}</td>
              <td class="text-right">R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td class="text-right"><strong>R$ ${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-box">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="total-row grand">
            <span>Total:</span>
            <span>R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  ` : ''}

  ${paymentTerms.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Condições de Pagamento</h2>
      ${paymentTerms.map(term => {
        if (term.payment_type === 'one_time') {
          const installments = calculateInstallments(term);
          return `
            <h3 style="margin-bottom: 15px; color: #555;">Pagamento Único (P&S)</h3>
            ${term.discount_percent > 0 ? `<p style="margin-bottom: 10px;"><strong>Desconto financeiro:</strong> ${term.discount_percent}%</p>` : ''}
            <table class="payment-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Vencimento</th>
                  <th class="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${installments.map(inst => `
                  <tr>
                    <td>${inst.type}</td>
                    <td>${new Date(inst.date).toLocaleDateString('pt-BR')}</td>
                    <td class="text-right">R$ ${inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${term.comments ? `<div class="content">${formatRichText(term.comments)}</div>` : ''}
          `;
        } else {
          return `
            <h3 style="margin-bottom: 15px; color: #555;">Mensalidade Recorrente (MRR)</h3>
            <div class="info-grid">
              <span class="info-label">Valor Mensal:</span>
              <span class="info-value">R$ ${(term.monthly_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              
              <span class="info-label">Total do Contrato:</span>
              <span class="info-value">R$ ${(term.contract_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              
              ${term.first_payment_date ? `
                <span class="info-label">Primeira Cobrança:</span>
                <span class="info-value">${new Date(term.first_payment_date).toLocaleDateString('pt-BR')}</span>
              ` : ''}
            </div>
            ${term.comments ? `<div class="content">${formatRichText(term.comments)}</div>` : ''}
          `;
        }
      }).join('')}
    </div>
  ` : ''}

  ${proposal.terms ? `
    <div class="section">
      <h2 class="section-title">Termos e Condições</h2>
      <div class="content">
        ${formatRichText(proposal.terms)}
      </div>
    </div>
  ` : ''}

  ${proposal.notes ? `
    <div class="section">
      <h2 class="section-title">Observações</h2>
      <div class="content">
        ${formatRichText(proposal.notes)}
      </div>
    </div>
  ` : ''}

  <div class="footer">
    <p><strong>${org.name}</strong> ${org.legal_name ? `- ${org.legal_name}` : ''}</p>
    ${org.cnpj ? `<p>CNPJ: ${org.cnpj}</p>` : ''}
    ${org.address_street ? `
      <p>${org.address_street}${org.address_number ? `, ${org.address_number}` : ''}${org.address_complement ? ` - ${org.address_complement}` : ''}</p>
      <p>${org.address_city || ''}${org.address_state ? ` - ${org.address_state}` : ''}${org.address_zip ? ` - CEP: ${org.address_zip}` : ''}</p>
    ` : ''}
    <p style="margin-top: 20px; font-style: italic;">Documento gerado automaticamente em ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>
  `;
}
