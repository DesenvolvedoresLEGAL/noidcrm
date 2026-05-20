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

    // Fetch proposal items with measurement unit and product image fallback
    const { data: items } = await supabaseClient
      .from('proposal_items')
      .select(`
        *,
        measurement_unit:measurement_units(id, name, abbreviation),
        product:products(image_url)
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

// PRICE CORE 2.0B — Ledger reader (mirrors src/lib/proposals/pricingLedger.ts)
// When the proposal has a usable pricing_breakdown_snapshot, the PDF totals and
// payment schedule MUST come from the ledger instead of summing items locally.
// For accepted proposals with approved_amount, the approved snapshot wins.
function getPdfPricingView(proposal: any) {
  const status = proposal?.status;
  const approvedAmount = proposal?.approved_amount;
  const approvedSchedule = Array.isArray(proposal?.approved_payment_schedule)
    ? proposal.approved_payment_schedule
    : null;
  const snap = proposal?.pricing_breakdown_snapshot;
  const hasSnap = snap && typeof snap === 'object' && snap.version && snap.effective_amount != null;

  if (!hasSnap) {
    console.warn('[PRICE CORE 2.0B] PDF rendering without pricing_breakdown_snapshot, proposal', proposal?.id, 'status', status);
    return null;
  }

  const md = snap.manual_discount ?? {};
  const dyn = snap.dynamic_adjustment ?? {};
  const num = (v: any, f = 0) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : f;
  };

  const isAcceptedFrozen = status === 'accepted' && approvedAmount != null;
  const effectiveAmount = isAcceptedFrozen ? num(approvedAmount) : num(snap.effective_amount);
  const paymentSchedule = isAcceptedFrozen && approvedSchedule && approvedSchedule.length
    ? approvedSchedule
    : (Array.isArray(snap.payment_schedule) ? snap.payment_schedule : []);

  return {
    subtotalItems: num(snap.subtotal_items),
    recurringSubtotal: num(snap.recurring_subtotal),
    manualDiscountPercent: num(md.percent),
    manualDiscountAmount: num(md.amount),
    inventoryAdjustmentAmount: num(snap.inventory_adjustment_amount),
    baseAmount: num(snap.base_amount),
    dynamicEnabled: !!dyn.enabled,
    dynamicPercent: num(dyn.percent),
    dynamicAmount: num(dyn.amount),
    dynamicTierLabel: dyn.tier_label ?? null,
    effectiveAmount,
    paymentScheduleTotal: num(snap.payment_schedule_total),
    paymentSchedule,
    hasDivergence: !!snap.has_divergence,
    frozen: isAcceptedFrozen,
  };
}

function generateProposalHTML(proposal: any, items: any[], paymentTerms: any[], layoutPages: any[] = []): string {
  const org = proposal.organization;
  const opp = proposal.opportunity;
  const account = opp?.account;
  const contact = opp?.contact;

  // PRICE CORE 2.0B — pricing ledger as primary source for totals + payment schedule
  const ledger = getPdfPricingView(proposal);

  // Separate items by billing_type (still needed to render the items table)
  const oneTimeItems = items.filter(item => item.billing_type !== 'recurring');
  const recurringItems = items.filter(item => item.billing_type === 'recurring');
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const recurringTotal = recurringItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // Legacy totals (fallback only)
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const legacyTotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = ledger ? ledger.effectiveAmount : legacyTotal;
  const hasDiscount = items.some(item => item.discount_percent > 0);
  const hasBothTypes = oneTimeTotal > 0 && recurringTotal > 0;
  const fmtBRL = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Format rich text
  const formatRichText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calculateInstallments = (term: any) => {
    if (term.payment_type !== 'one_time') return [];
    const installments = [];
    const discountedTotal = oneTimeTotal * (1 - (term.discount_percent || 0) / 100);
    const entryAmount = discountedTotal * ((term.entry_percent || 0) / 100);
    if (entryAmount > 0) {
      installments.push({ type: 'Entrada', date: term.entry_date, amount: entryAmount });
    }
    const remaining = discountedTotal - entryAmount;
    const installmentAmount = remaining / (term.installments || 1);
    const firstDateStr = term.first_installment_date || formatLocalDate(new Date());
    const firstDate = parseLocalDate(firstDateStr);
    for (let i = 0; i < (term.installments || 1); i++) {
      const date = new Date(firstDate);
      date.setDate(date.getDate() + (i * (term.installment_interval_days || 30)));
      installments.push({ type: `Parcela ${i + 1}`, date: formatLocalDate(date), amount: installmentAmount });
    }
    return installments;
  };

  const calculateRecurringSchedule = (term: any, mrrValue: number) => {
    const schedule = [];
    const contractMonths = term.contract_months || term.contract_duration_months || 12;
    const billingDay = term.billing_day || term.recurring_due_day || 10;
    const startDateStr = term.contract_start_date || term.first_payment_date;
    let startDate = startDateStr ? parseLocalDate(startDateStr) : new Date();
    for (let i = 0; i < contractMonths; i++) {
      const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, billingDay);
      schedule.push({ number: i + 1, date: formatLocalDate(dueDate), amount: mrrValue });
    }
    return schedule;
  };

  // Helper: extract contact phone/email from JSONB arrays
  const getContactPhone = () => {
    if (!contact?.telefones) return null;
    try {
      const phones = Array.isArray(contact.telefones) ? contact.telefones : [];
      const primary = phones.find((p: any) => p.is_primary) || phones[0];
      return primary?.value || null;
    } catch { return null; }
  };
  const getContactEmail = () => {
    if (!contact?.emails) return null;
    try {
      const emails = Array.isArray(contact.emails) ? contact.emails : [];
      const primary = emails.find((e: any) => e.is_primary) || emails[0];
      return primary?.value || null;
    } catch { return null; }
  };

  // Helper: get account phone
  const getAccountPhone = () => {
    if (!account?.telefones) return null;
    try {
      const phones = Array.isArray(account.telefones) ? account.telefones : [];
      const primary = phones.find((p: any) => p.is_primary) || phones[0];
      return primary?.value || null;
    } catch { return null; }
  };

  // Helper: check if file URL is an image
  const isImageUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.webp');
  };
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta - ${proposal.title || 'Sem título'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
    .logo { max-width: 200px; height: auto; }
    .company-info { text-align: right; max-width: 55%; }
    .company-info h1 {
      color: ${org.primary_color || '#000'};
      margin-bottom: 10px;
      font-size: 22px;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .company-info p { margin: 4px 0; color: #666; font-size: 13px; }
    .section { margin-bottom: 40px; }
    .section-title {
      color: ${org.primary_color || '#000'};
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 12px;
      margin-bottom: 20px;
      font-size: 22px;
      font-weight: 600;
    }
    /* 3-column info cards */
    .info-cards {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin: 25px 0;
    }
    .info-card {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      border-top: 3px solid ${org.primary_color || '#000'};
    }
    .info-card h3 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${org.primary_color || '#000'};
      margin-bottom: 12px;
      font-weight: 700;
    }
    .info-card .field { margin-bottom: 8px; font-size: 13px; }
    .info-card .field-label { color: #888; font-size: 11px; display: block; margin-bottom: 2px; }
    .info-card .field-value { color: #333; font-weight: 500; word-break: break-word; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .items-table thead { background: ${org.primary_color || '#000'}; color: white; }
    .items-table th {
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
    }
    .items-table td { padding: 12px 10px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    .items-table tbody tr:hover { background: #f9f9f9; }
    .item-name { font-weight: 600; color: #333; }
    .item-desc { color: #666; font-size: 12px; margin-top: 4px; line-height: 1.5; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals-section { margin-top: 30px; display: flex; justify-content: flex-end; }
    .totals-box { width: 350px; background: #f9f9f9; padding: 25px; border-radius: 8px; }
    .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-size: 14px; }
    .total-row.grand {
      font-size: 18px; font-weight: bold; color: ${org.primary_color || '#000'};
      border-top: 3px solid ${org.primary_color || '#000'}; border-bottom: none;
      margin-top: 10px; padding-top: 15px;
    }
    .content { line-height: 1.8; color: #444; margin: 20px 0; }
    .payment-section { margin-bottom: 35px; }
    .payment-header {
      display: flex; align-items: center; gap: 16px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      padding: 20px 24px; border-radius: 12px 12px 0 0;
      border-left: 5px solid ${org.primary_color || '#000'};
    }
    .payment-header-recurring {
      border-left-color: #10b981;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    }
    .payment-icon {
      width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; font-size: 24px;
    }
    .payment-icon-onetime { background: ${org.primary_color || '#000'}; color: white; }
    .payment-icon-recurring { background: #10b981; color: white; }
    .payment-body {
      background: #fff; border: 1px solid #e5e7eb; border-top: none;
      border-radius: 0 0 12px 12px; padding: 24px;
    }
    .payment-method-badge {
      display: inline-block; padding: 6px 14px; background: rgba(255,255,255,0.8);
      border-radius: 20px; font-size: 12px; color: #374151; font-weight: 600; text-transform: uppercase;
    }
    .mrr-summary-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #bbf7d0;
    }
    .mrr-summary-item { text-align: center; }
    .mrr-summary-label { font-size: 12px; color: #6b7280; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .mrr-summary-value { font-size: 22px; font-weight: 700; color: #059669; }
    .mrr-summary-value.neutral { color: #374151; }
    .contract-info {
      display: flex; flex-wrap: wrap; gap: 24px; padding: 16px 0;
      border-bottom: 1px solid #e5e7eb; margin-bottom: 24px; font-size: 14px; color: #4b5563;
    }
    .contract-info-item { display: flex; align-items: center; gap: 8px; }
    .schedule-title {
      font-weight: 700; color: #374151; margin-bottom: 16px; font-size: 16px;
      display: flex; align-items: center; gap: 8px;
    }
    .schedule-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .schedule-table th { background: #10b981; color: white; padding: 12px 16px; text-align: left; font-weight: 600; }
    .schedule-table td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
    .schedule-table tbody tr:nth-child(even) { background: #f9fafb; }
    .onetime-table th { background: ${org.primary_color || '#000'}; color: white; padding: 12px 16px; text-align: left; font-weight: 600; }
    .onetime-table td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
    .payment-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .payment-table th, .payment-table td { padding: 12px; border: 1px solid #e0e0e0; text-align: left; }
    .payment-table th { background: #f5f5f5; font-weight: 600; }
    .contract-page { page-break-before: always; margin-top: 40px; }
    .contract-page img { max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 4px; }
    .footer {
      margin-top: 60px; padding-top: 30px; border-top: 3px solid #e0e0e0;
      text-align: center; color: #666; font-size: 13px;
    }
    .footer p { margin: 8px 0; }
    @media print {
      body { padding: 20px; }
      .items-table { box-shadow: none; }
      .payment-section { break-inside: avoid; }
      .contract-page { break-before: page; }
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
      ${org.email ? `<p>${org.email}</p>` : ''}
      ${org.phone ? `<p>${org.phone}</p>` : ''}
      ${org.website ? `<p>${org.website}</p>` : ''}
      ${org.address_street ? `<p>${org.address_street}${org.address_number ? `, ${org.address_number}` : ''}${org.address_city ? ` - ${org.address_city}` : ''}${org.address_state ? `/${org.address_state}` : ''}</p>` : ''}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Proposta Comercial</h2>
    <div class="info-cards">
      <!-- Card Cliente -->
      <div class="info-card">
        <h3>🏢 Cliente</h3>
        <div class="field">
          <span class="field-label">Razão Social</span>
          <span class="field-value">${account?.razao_social || proposal.client_name || 'N/A'}</span>
        </div>
        ${account?.nome_fantasia ? `<div class="field"><span class="field-label">Nome Fantasia</span><span class="field-value">${account.nome_fantasia}</span></div>` : ''}
        ${account?.cnpj ? `<div class="field"><span class="field-label">CNPJ</span><span class="field-value">${account.cnpj}</span></div>` : ''}
        ${account?.cpf ? `<div class="field"><span class="field-label">CPF</span><span class="field-value">${account.cpf}</span></div>` : ''}
        ${getAccountPhone() ? `<div class="field"><span class="field-label">Telefone</span><span class="field-value">${getAccountPhone()}</span></div>` : ''}
        ${account?.emails?.[0] ? `<div class="field"><span class="field-label">Email</span><span class="field-value">${account.emails[0]}</span></div>` : ''}
        ${account?.logradouro ? `<div class="field"><span class="field-label">Endereço</span><span class="field-value">${account.logradouro}${account.numero ? `, ${account.numero}` : ''}${account.bairro ? ` - ${account.bairro}` : ''}<br/>${account.cidade || ''}${account.uf ? `/${account.uf}` : ''}${account.cep ? ` - ${account.cep}` : ''}</span></div>` : ''}
      </div>

      <!-- Card Contato -->
      <div class="info-card">
        <h3>👤 Contato</h3>
        ${contact ? `
          <div class="field">
            <span class="field-label">Nome</span>
            <span class="field-value">${contact.name || 'N/A'}</span>
          </div>
          ${contact.cargo ? `<div class="field"><span class="field-label">Cargo</span><span class="field-value">${contact.cargo}</span></div>` : ''}
          ${getContactPhone() ? `<div class="field"><span class="field-label">Telefone</span><span class="field-value">${getContactPhone()}</span></div>` : ''}
          ${getContactEmail() ? `<div class="field"><span class="field-label">Email</span><span class="field-value">${getContactEmail()}</span></div>` : ''}
        ` : `<div class="field"><span class="field-value" style="color: #999;">Sem contato vinculado</span></div>`}
      </div>

      <!-- Card Proposta -->
      <div class="info-card">
        <h3>📋 Proposta</h3>
        <div class="field">
          <span class="field-label">Nº</span>
          <span class="field-value">${proposal.id.substring(0, 8).toUpperCase()}</span>
        </div>
        <div class="field">
          <span class="field-label">Título</span>
          <span class="field-value">${proposal.opportunity?.title || proposal.title || 'Sem título'}</span>
        </div>
        <div class="field">
          <span class="field-label">Data de Emissão</span>
          <span class="field-value">${new Date(proposal.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
        ${proposal.expires_at ? `<div class="field"><span class="field-label">Validade</span><span class="field-value">${new Date(proposal.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>` : ''}
        ${proposal.version ? `<div class="field"><span class="field-label">Versão</span><span class="field-value">v${proposal.version}</span></div>` : ''}
      </div>
    </div>
  </div>

  ${proposal.introduction ? `
    <div class="section">
      <h2 class="section-title">Apresentação</h2>
      <div class="content">${formatRichText(proposal.introduction)}</div>
    </div>
  ` : ''}

  ${items.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Itens da Proposta</h2>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 14%;">Foto</th>
            <th style="width: 36%;">Item / Descrição</th>
            <th class="text-center" style="width: 8%;">Qtd</th>
            <th class="text-right" style="width: 14%;">Preço Unit.</th>
            <th class="text-right" style="width: 11%;">Desconto</th>
            <th class="text-right" style="width: 17%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const isPointDay = item.billing_type === 'point_day';
            const points = item.quantity_points;
            const days = item.billing_days;
            const ppd = item.unit_price_point_day;
            const qtyCell = isPointDay && points && days
              ? `${points} pts × ${days} ${days === 1 ? 'diária' : 'diárias'}`
              : `${item.quantity}${item.measurement_unit?.abbreviation ? ' ' + item.measurement_unit.abbreviation : ''}`;
            const priceCell = isPointDay && ppd != null
              ? `R$ ${Number(ppd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span style="font-size:0.75em;color:#666;">/ ponto-dia</span>`
              : `R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            const imgSrc = item.image_url || item.product?.image_url || null;
            const thumbCell = imgSrc
              ? `<img src="${imgSrc}" alt="" style="width:96px;height:96px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;display:block;" onerror="this.style.visibility='hidden'" />`
              : `<div style="width:96px;height:96px;border-radius:6px;border:1px solid #e5e7eb;background:#f3f4f6;"></div>`;
            return `
            <tr>
              <td style="vertical-align:top;">${thumbCell}</td>
              <td>
                <div class="item-name">${item.name}</div>
                ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
              </td>
              <td class="text-center">${qtyCell}</td>
              <td class="text-right">${priceCell}</td>
              <td class="text-right">${item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
              <td class="text-right"><strong>R$ ${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-box">
          ${ledger ? `
            <div class="total-row">
              <span>Subtotal dos itens:</span>
              <span>${fmtBRL(ledger.subtotalItems)}</span>
            </div>
            ${ledger.manualDiscountAmount > 0 ? `
              <div class="total-row" style="color:#dc2626;">
                <span>Desconto comercial${ledger.manualDiscountPercent > 0 ? ` (${ledger.manualDiscountPercent}%)` : ''}:</span>
                <span>- ${fmtBRL(ledger.manualDiscountAmount)}</span>
              </div>
            ` : ''}
            ${ledger.inventoryAdjustmentAmount !== 0 ? `
              <div class="total-row">
                <span>Ajuste de estoque:</span>
                <span>${ledger.inventoryAdjustmentAmount >= 0 ? '+ ' : '- '}${fmtBRL(Math.abs(ledger.inventoryAdjustmentAmount))}</span>
              </div>
            ` : ''}
            ${(ledger.manualDiscountAmount > 0 || ledger.inventoryAdjustmentAmount !== 0) ? `
              <div class="total-row">
                <span><strong>Base comercial:</strong></span>
                <span><strong>${fmtBRL(ledger.baseAmount)}</strong></span>
              </div>
            ` : ''}
            ${ledger.dynamicEnabled && ledger.dynamicAmount !== 0 ? `
              <div class="total-row" style="color:#b45309;">
                <span>Ajuste por antecedência${ledger.dynamicPercent !== 0 ? ` (${ledger.dynamicPercent >= 0 ? '+' : ''}${ledger.dynamicPercent}%)` : ''}${ledger.dynamicTierLabel ? ` — ${ledger.dynamicTierLabel}` : ''}:</span>
                <span>${ledger.dynamicAmount >= 0 ? '+ ' : '- '}${fmtBRL(Math.abs(ledger.dynamicAmount))}</span>
              </div>
            ` : ''}
            <div class="total-row grand">
              <span>${ledger.frozen ? 'Total aprovado' : 'Total vigente'}:</span>
              <span>${fmtBRL(ledger.effectiveAmount)}</span>
            </div>
          ` : `
            ${hasBothTypes ? `
              <div class="total-row">
                <span>Subtotal Avulso:</span>
                <span>${fmtBRL(oneTimeTotal)}</span>
              </div>
              <div class="total-row">
                <span>Subtotal Recorrente:</span>
                <span>${fmtBRL(recurringTotal)}</span>
              </div>
            ` : (subtotal !== total ? `
              <div class="total-row">
                <span>Subtotal:</span>
                <span>${fmtBRL(subtotal)}</span>
              </div>
            ` : '')}
            <div class="total-row grand">
              <span>Total:</span>
              <span>${fmtBRL(total)}</span>
            </div>
          `}
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
        
        if (oneTimeTerm && oneTimeTotal > 0) {
          const installments = calculateInstallments(oneTimeTerm);
          const discountPercent = oneTimeTerm.discount_percent || 0;
          const discountAmount = oneTimeTotal * (discountPercent / 100);
          const discountedTotal = oneTimeTotal - discountAmount;
          html += `
            <div class="payment-section">
              <div class="payment-header">
                <div class="payment-icon payment-icon-onetime">⚡</div>
                <div>
                  <div style="font-size: 18px; font-weight: 700; color: #1f2937;">Pagamento Avulso</div>
                  <div style="margin-top: 6px;">
                    <span class="payment-method-badge">${oneTimeTerm.payment_method?.toUpperCase() || 'PIX'}</span>
                    ${discountPercent > 0 ? `<span class="payment-method-badge" style="margin-left: 8px; background: #fef3c7; color: #92400e;">-${discountPercent}% Desconto</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="payment-body">
                ${discountPercent > 0 ? `
                  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 12px;">Resumo Financeiro</div>
                    <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
                      <span style="color: #6b7280;">Subtotal Avulso:</span>
                      <span>R$ ${oneTimeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #dc2626; font-weight: 500;">
                      <span>Desconto (${discountPercent}%):</span>
                      <span>- R$ ${discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style="border-top: 2px solid ${org.primary_color || '#000'}; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 16px; font-weight: 700;">
                      <span>Total com Desconto:</span>
                      <span style="color: ${org.primary_color || '#000'};">R$ ${discountedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ` : ''}
                <table class="payment-table onetime-table" style="border-collapse: collapse; width: 100%;">
                  <thead><tr><th>Parcela</th><th>Vencimento</th><th class="text-right">Valor</th></tr></thead>
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
        
        if (recurringTerm && recurringTotal > 0) {
          const mrrValue = recurringTerm.monthly_value || recurringTotal;
          const contractMonths = recurringTerm.contract_months || recurringTerm.contract_duration_months || 12;
          const billingDay = recurringTerm.billing_day || recurringTerm.recurring_due_day || 10;
          const contractTotal = mrrValue * contractMonths;
          const schedule = calculateRecurringSchedule(recurringTerm, mrrValue);
          const startDateStr = recurringTerm.contract_start_date || recurringTerm.first_payment_date;
          
          html += `
            <div class="payment-section">
              <div class="payment-header payment-header-recurring">
                <div class="payment-icon payment-icon-recurring">🔄</div>
                <div>
                  <div style="font-size: 18px; font-weight: 700; color: #1f2937;">Pagamento Recorrente</div>
                  <div style="margin-top: 6px;">
                    <span class="payment-method-badge">${recurringTerm.payment_method?.toUpperCase() || 'BOLETO'}</span>
                    ${recurringTerm.auto_renewal ? `<span class="payment-method-badge" style="margin-left: 8px; background: #dbeafe; color: #1e40af;">🔄 Renovação Automática</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="payment-body">
                <div class="mrr-summary-grid">
                  <div class="mrr-summary-item">
                    <div class="mrr-summary-label">Valor Mensal</div>
                    <div class="mrr-summary-value">R$ ${mrrValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div class="mrr-summary-item">
                    <div class="mrr-summary-label">Total do Contrato (${contractMonths}m)</div>
                    <div class="mrr-summary-value neutral">R$ ${contractTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div class="contract-info">
                  <div class="contract-info-item"><span>📅</span><span><strong>Início:</strong> ${startDateStr ? new Date(startDateStr + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir'}</span></div>
                  <div class="contract-info-item"><span>📋</span><span><strong>Prazo:</strong> ${contractMonths} meses</span></div>
                  <div class="contract-info-item"><span>🗓️</span><span><strong>Vencimento:</strong> Dia ${billingDay}</span></div>
                </div>
                <div class="schedule-title"><span>📋</span><span>Cronograma Completo de Cobranças</span></div>
                <table class="schedule-table">
                  <thead><tr><th>Parcela</th><th>Vencimento</th><th class="text-right">Valor</th></tr></thead>
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
      <div class="content">${formatRichText(proposal.terms)}</div>
    </div>
  ` : ''}

  ${proposal.notes ? `
    <div class="section">
      <h2 class="section-title">Observações</h2>
      <div class="content">${formatRichText(proposal.notes)}</div>
    </div>
  ` : ''}

  ${layoutPages.length > 0 ? `
    ${layoutPages.map((page, index) => `
      <div class="contract-page">
        <h2 class="section-title">${index === 0 ? 'Anexos do Contrato' : ''} ${page.file_name || 'Documento ' + (index + 1)}</h2>
        ${isImageUrl(page.file_url) ? `
          <img src="${page.file_url}" alt="${page.file_name || 'Documento'}" style="max-width: 100%; height: auto;" />
        ` : `
          <div style="padding: 30px; text-align: center; background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px;">
            <p style="color: #666; margin-bottom: 15px;">Documento disponível para download:</p>
            <a href="${page.file_url}" target="_blank"
               style="display: inline-block; padding: 12px 24px; background: ${org.primary_color || '#000'}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
              📥 Abrir ${page.file_name || 'Documento'}
            </a>
          </div>
        `}
      </div>
    `).join('')}
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
