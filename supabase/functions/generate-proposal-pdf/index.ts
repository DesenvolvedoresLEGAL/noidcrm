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
        organization:organizations(*),
        layout:proposal_layouts(
          id,
          name,
          description
        )
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

    // Fetch proposal items with measurement unit
    const { data: items } = await supabaseClient
      .from('proposal_items')
      .select(`
        *,
        measurement_unit:measurement_units(id, name, abbreviation)
      `)
      .eq('proposal_id', proposalId)
      .order('order_index', { ascending: true });

    // Fetch payment terms
    const { data: paymentTerms } = await supabaseClient
      .from('proposal_payment_terms')
      .select('*')
      .eq('proposal_id', proposalId);

    // Fetch layout pages if proposal has a layout
    let layoutPages: any[] = [];
    if (proposal.layout_id) {
      const { data: pages } = await supabaseClient
        .from('proposal_layout_pages')
        .select('*')
        .eq('layout_id', proposal.layout_id)
        .order('page_number', { ascending: true });
      
      if (pages && pages.length > 0) {
        layoutPages = pages;
        console.log(`Found ${layoutPages.length} layout pages for layout ${proposal.layout_id}`);
      }
    }

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

    // Generate HTML for the proposal with layout pages
    const html = generateProposalHTML(processedProposal, items || [], paymentTerms || [], layoutPages);

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

    // Security: Generate signed URL instead of public URL (bucket is now private)
    // Long expiry for PDFs stored in database - 7 days, will be refreshed on access
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient
      .storage
      .from('proposal-pdfs')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days expiry

    if (signedUrlError) throw signedUrlError;
    
    const signedUrl = signedUrlData.signedUrl;

    // Update proposal with signed PDF URL
    // Note: Frontend should handle expired URLs by requesting a new one
    const { error: updateError } = await supabaseClient
      .from('proposals')
      .update({ pdf_url: signedUrl })
      .eq('id', proposalId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, pdfUrl: signedUrl }),
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

function generateProposalHTML(proposal: any, items: any[], paymentTerms: any[], layoutPages: any[] = []): string {
  const org = proposal.organization;
  const opp = proposal.opportunity;
  const account = opp?.account;
  
  // Separate items by billing_type
  const oneTimeItems = items.filter(item => item.billing_type !== 'recurring');
  const recurringItems = items.filter(item => item.billing_type === 'recurring');
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const recurringTotal = recurringItems.reduce((sum, item) => sum + (item.total || 0), 0);
  
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

  // Helper to parse date string as local date (avoiding UTC interpretation)
  const parseLocalDate = (dateString: string): Date => {
    // Format: YYYY-MM-DD - parse as local date
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper to format date as YYYY-MM-DD preserving local date
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate installments for one-time payment terms
  const calculateInstallments = (term: any) => {
    if (term.payment_type !== 'one_time') return [];
    
    const installments = [];
    // Use oneTimeTotal instead of total for correct calculation
    const discountedTotal = oneTimeTotal * (1 - (term.discount_percent || 0) / 100);
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
    
    // Use local date parsing to avoid timezone shift
    const firstDateStr = term.first_installment_date || formatLocalDate(new Date());
    const firstDate = parseLocalDate(firstDateStr);
    
    for (let i = 0; i < (term.installments || 1); i++) {
      const date = new Date(firstDate);
      date.setDate(date.getDate() + (i * (term.installment_interval_days || 30)));
      installments.push({
        type: `Parcela ${i + 1}`,
        date: formatLocalDate(date),
        amount: installmentAmount,
      });
    }
    
    return installments;
  };

  // Calculate recurring schedule with all MRR installment dates
  const calculateRecurringSchedule = (term: any, mrrValue: number) => {
    const schedule = [];
    const contractMonths = term.contract_months || term.contract_duration_months || 12;
    const billingDay = term.billing_day || term.recurring_due_day || 10;
    const startDateStr = term.contract_start_date || term.first_payment_date;
    
    let startDate = startDateStr ? parseLocalDate(startDateStr) : new Date();
    
    for (let i = 0; i < contractMonths; i++) {
      const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, billingDay);
      schedule.push({
        number: i + 1,
        date: formatLocalDate(dueDate),
        amount: mrrValue,
      });
    }
    
    return schedule;
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
    /* World-class payment section styles */
    .payment-section {
      margin-bottom: 35px;
    }
    .payment-header {
      display: flex;
      align-items: center;
      gap: 16px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      padding: 20px 24px;
      border-radius: 12px 12px 0 0;
      border-left: 5px solid ${org.primary_color || '#000'};
    }
    .payment-header-recurring {
      border-left-color: #10b981;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    }
    .payment-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 24px;
    }
    .payment-icon-onetime {
      background: ${org.primary_color || '#000'};
      color: white;
    }
    .payment-icon-recurring {
      background: #10b981;
      color: white;
    }
    .payment-body {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 24px;
    }
    .payment-method-badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(255,255,255,0.8);
      border-radius: 20px;
      font-size: 12px;
      color: #374151;
      font-weight: 600;
      text-transform: uppercase;
    }
    .mrr-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 24px;
      border: 1px solid #bbf7d0;
    }
    .mrr-summary-item {
      text-align: center;
    }
    .mrr-summary-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .mrr-summary-value {
      font-size: 22px;
      font-weight: 700;
      color: #059669;
    }
    .mrr-summary-value.neutral {
      color: #374151;
    }
    .contract-info {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      padding: 16px 0;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 24px;
      font-size: 14px;
      color: #4b5563;
    }
    .contract-info-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .schedule-title {
      font-weight: 700;
      color: #374151;
      margin-bottom: 16px;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .schedule-table th {
      background: #10b981;
      color: white;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
    }
    .schedule-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .schedule-table tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    .schedule-table tbody tr:hover {
      background: #ecfdf5;
    }
    .onetime-table th {
      background: ${org.primary_color || '#000'};
      color: white;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
    }
    .onetime-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .onetime-table tbody tr:hover {
      background: #f9fafb;
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
      .payment-section {
        break-inside: avoid;
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
      <span class="info-value">${proposal.opportunity?.title || proposal.title || 'Sem título'}</span>
      
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
              <td class="text-center">${item.quantity}${item.measurement_unit?.abbreviation ? ' ' + item.measurement_unit.abbreviation : ''}</td>
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
      
      ${(() => {
        const oneTimeTerm = paymentTerms.find(t => t.payment_type === 'one_time');
        const recurringTerm = paymentTerms.find(t => t.payment_type === 'recurring');
        
        let html = '';
        
        // === PAGAMENTO AVULSO ===
        if (oneTimeTerm && oneTimeTotal > 0) {
          const installments = calculateInstallments(oneTimeTerm);
          html += `
            <div class="payment-section">
              <div class="payment-header">
                <div class="payment-icon payment-icon-onetime">⚡</div>
                <div>
                  <div style="font-size: 18px; font-weight: 700; color: #1f2937;">Pagamento Avulso</div>
                  <div style="margin-top: 6px;">
                    <span class="payment-method-badge">${oneTimeTerm.payment_method?.toUpperCase() || 'PIX'}</span>
                    ${oneTimeTerm.discount_percent > 0 ? `<span class="payment-method-badge" style="margin-left: 8px; background: #fef3c7; color: #92400e;">-${oneTimeTerm.discount_percent}% Desconto</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="payment-body">
                <table class="payment-table onetime-table" style="border-collapse: collapse; width: 100%;">
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th class="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${installments.map(inst => `
                      <tr>
                        <td><strong>${inst.type}</strong></td>
                        <td>${new Date(inst.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td class="text-right"><strong>R$ ${inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                ${oneTimeTerm.comments ? `<div class="content" style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 8px;">${formatRichText(oneTimeTerm.comments)}</div>` : ''}
              </div>
            </div>
          `;
        }
        
        // === PAGAMENTO RECORRENTE (MRR) ===
        if (recurringTerm && recurringTotal > 0) {
          const mrrValue = recurringTerm.monthly_value || recurringTotal;
          const contractMonths = recurringTerm.contract_months || recurringTerm.contract_duration_months || 12;
          const billingDay = recurringTerm.billing_day || recurringTerm.recurring_due_day || 10;
          const contractTotal = mrrValue * contractMonths;
          const arrValue = mrrValue * 12;
          const schedule = calculateRecurringSchedule(recurringTerm, mrrValue);
          const startDateStr = recurringTerm.contract_start_date || recurringTerm.first_payment_date;
          
          html += `
            <div class="payment-section">
              <div class="payment-header payment-header-recurring">
                <div class="payment-icon payment-icon-recurring">🔄</div>
                <div>
                  <div style="font-size: 18px; font-weight: 700; color: #1f2937;">Pagamento Recorrente (MRR)</div>
                  <div style="margin-top: 6px;">
                    <span class="payment-method-badge">${recurringTerm.payment_method?.toUpperCase() || 'BOLETO'}</span>
                    ${recurringTerm.auto_renewal ? `<span class="payment-method-badge" style="margin-left: 8px; background: #dbeafe; color: #1e40af;">🔄 Renovação Automática</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="payment-body">
                <!-- Resumo MRR -->
                <div class="mrr-summary-grid">
                  <div class="mrr-summary-item">
                    <div class="mrr-summary-label">MRR (Mensal)</div>
                    <div class="mrr-summary-value">R$ ${mrrValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div class="mrr-summary-item">
                    <div class="mrr-summary-label">Contrato (${contractMonths}m)</div>
                    <div class="mrr-summary-value neutral">R$ ${contractTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div class="mrr-summary-item">
                    <div class="mrr-summary-label">ARR (Anual)</div>
                    <div class="mrr-summary-value neutral">R$ ${arrValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
                
                <!-- Info do Contrato -->
                <div class="contract-info">
                  <div class="contract-info-item">
                    <span>📅</span>
                    <span><strong>Início:</strong> ${startDateStr ? new Date(startDateStr + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir'}</span>
                  </div>
                  <div class="contract-info-item">
                    <span>📋</span>
                    <span><strong>Prazo:</strong> ${contractMonths} meses</span>
                  </div>
                  <div class="contract-info-item">
                    <span>🗓️</span>
                    <span><strong>Vencimento:</strong> Dia ${billingDay}</span>
                  </div>
                </div>
                
                <!-- Cronograma Completo de Parcelas -->
                <div class="schedule-title">
                  <span>📋</span>
                  <span>Cronograma Completo de Cobranças</span>
                </div>
                <table class="schedule-table">
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th class="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${schedule.map(s => `
                      <tr>
                        <td><strong>Parcela ${s.number}/${contractMonths}</strong></td>
                        <td>${new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td class="text-right"><strong>R$ ${s.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                ${recurringTerm.comments ? `<div class="content" style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px;">${formatRichText(recurringTerm.comments)}</div>` : ''}
              </div>
            </div>
          `;
        }
        
        return html;
      })()}
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

  ${layoutPages.length > 0 ? `
    <div class="section" style="page-break-before: always;">
      <h2 class="section-title">Anexos do Contrato</h2>
      <p style="color: #666; margin-bottom: 20px;">Os documentos contratuais abaixo fazem parte integrante desta proposta comercial.</p>
      
      ${layoutPages.map((page, index) => `
        <div style="margin-bottom: 30px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background: #f5f5f5; padding: 12px 20px; border-bottom: 1px solid #e0e0e0;">
            <strong style="color: #333;">📄 ${page.file_name || 'Documento ' + (index + 1)}</strong>
            <span style="float: right; color: #666; font-size: 13px;">Página ${page.page_number}</span>
          </div>
          <div style="padding: 20px; text-align: center; background: #fafafa;">
            <p style="color: #666; margin-bottom: 15px;">Clique para visualizar o documento:</p>
            <a href="${page.file_url}" 
               target="_blank" 
               style="display: inline-block; padding: 12px 24px; background: ${org.primary_color || '#000'}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
              📥 Abrir ${page.file_name || 'Documento'}
            </a>
          </div>
        </div>
      `).join('')}
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
