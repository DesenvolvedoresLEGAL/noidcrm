import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateBR } from './dateUtils';

interface ProposalItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
  markup_percent?: number;
  discount_percent?: number;
  total: number;
  billing_type?: 'one_time' | 'recurring';
  measurement_unit?: { abbreviation?: string };
}

interface PaymentInstallment {
  number: number;
  dueDate: string;
  amount: number;
  type: 'entry' | 'installment' | 'mrr';
}

interface RecurringPaymentData {
  monthly_value: number;
  contract_months: number;
  contract_total: number;
  first_payment_date?: string;
  billing_day?: number;
  payment_method?: string;
}

interface ProposalData {
  id: string;
  proposal_number?: string;
  proposal_version?: number;
  title?: string;
  client_name?: string;
  // Flat fields from buildProposalPDFData
  client_document?: string;
  client_address?: string;
  client_city?: string;
  client_state?: string;
  client_zip?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  seller_name?: string;
  seller_email?: string;
  seller_phone?: string;
  terms_and_conditions?: string;
  observations?: string;
  // End flat fields
  expires_at?: string;
  introduction?: string;
  terms?: string;
  notes?: string;
  currency?: string;
  total_amount?: number;
  subtotal?: number;
  discount_amount?: number;
  discount_percent?: number;
  status?: string;
  payment_method?: string;
  validity_days?: number;
  created_at?: string;
  organization?: {
    name?: string;
    legal_name?: string;
    cnpj?: string;
    logo_url?: string;
    email?: string;
    phone?: string;
    primary_color?: string;
    address_street?: string;
    address_number?: string;
    address_complement?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
  };
  opportunity?: {
    title?: string;
    account?: {
      razao_social?: string;
      nome_fantasia?: string;
      cnpj?: string;
      cidade?: string;
      uf?: string;
      logradouro?: string;
      numero?: string;
      bairro?: string;
    };
    contact?: {
      nome?: string;
      cargo?: string;
      emails?: string[];
      telefones?: string[];
    };
  };
  seller_profile?: {
    full_name?: string;
    email?: string;
    phone?: string;
  };
  layout?: {
    pages?: Array<{
      id?: string;
      file_name?: string;
      file_url?: string;
    }>;
    [key: string]: any;
  };
}

// Helper to strip HTML tags and decode entities
function stripHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

// Helper to format currency
function formatCurrency(value: number, currency: string = 'BRL'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';
  return `${symbol} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper to format CNPJ
function formatCNPJ(cnpj: string): string {
  if (!cnpj) return '';
  const numbers = cnpj.replace(/\D/g, '');
  if (numbers.length !== 14) return cnpj;
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Helper to format phone
function formatPhone(phone: string): string {
  if (!phone) return '';
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 11) {
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

// Convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 79, g: 70, b: 229 }; // Default indigo
}

export async function generateProposalPDFClient(
  proposal: ProposalData,
  items: ProposalItem[],
  installments: PaymentInstallment[],
  recurringPayment?: RecurringPaymentData
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  // Colors
  const primaryColor = proposal.organization?.primary_color || '#4F46E5';
  const primaryRgb = hexToRgb(primaryColor);
  const textDark = { r: 31, g: 41, b: 55 };
  const textMuted = { r: 107, g: 114, b: 128 };
  const borderColor = { r: 229, g: 231, b: 235 };
  const bgLight = { r: 249, g: 250, b: 251 };

  let yPos = margin;

  // ===== HEADER SECTION =====
  // Header background
  doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Organization name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const orgName = proposal.organization?.legal_name || proposal.organization?.name || 'Proposta Comercial';
  doc.text(orgName, margin, 18);

  // CNPJ
  if (proposal.organization?.cnpj) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${formatCNPJ(proposal.organization.cnpj)}`, margin, 25);
  }

  // Address
  const orgAddress = [
    proposal.organization?.address_street,
    proposal.organization?.address_number,
    proposal.organization?.address_city,
    proposal.organization?.address_state,
  ].filter(Boolean).join(', ');
  
  if (orgAddress) {
    doc.setFontSize(8);
    doc.text(orgAddress, margin, 31);
  }

  // Contact info
  const orgContactInfo = [
    proposal.organization?.phone ? formatPhone(proposal.organization.phone) : '',
    proposal.organization?.email || '',
  ].filter(Boolean).join(' • ');
  
  if (orgContactInfo) {
    doc.setFontSize(8);
    doc.text(orgContactInfo, margin, 37);
  }

  // Proposal number box (right side)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - margin - 55, 8, 55, 30, 2, 2, 'F');
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.text('PROPOSTA COMERCIAL', pageWidth - margin - 50, 15);
  
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const proposalNum = proposal.proposal_number || `#${proposal.id?.slice(0, 8)}`;
  doc.text(proposalNum, pageWidth - margin - 50, 23);
  
  if (proposal.proposal_version) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Versão ${proposal.proposal_version}`, pageWidth - margin - 50, 30);
  }
  
  if (proposal.expires_at) {
    doc.setFontSize(8);
    doc.text(`Válida até ${formatDateBR(proposal.expires_at)}`, pageWidth - margin - 50, 36);
  }

  yPos = 55;

  // ===== TITLE SECTION =====
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA COMERCIAL', margin, yPos);
  
  // Decorative line
  doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setLineWidth(1);
  doc.line(margin, yPos + 3, margin + 60, yPos + 3);
  
  yPos += 15;

  // ===== 3 CARDS: CLIENTE, CONTATO, PROPOSTA =====
  const cardWidth = (contentWidth - 10) / 3;
  const cardHeight = 42;

  // --- Client card ---
  doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
  doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
  doc.roundedRect(margin, yPos, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', margin + 4, yPos + 7);

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(9);
  // Use flat client_name or fallback to nested
  const clientName = proposal.client_name || 
    proposal.opportunity?.account?.nome_fantasia || 
    proposal.opportunity?.account?.razao_social || 
    'Cliente';
  doc.text(clientName.substring(0, 30), margin + 4, yPos + 14);

  // Client CNPJ - use flat client_document or nested
  const clientCNPJ = proposal.client_document || proposal.opportunity?.account?.cnpj;
  if (clientCNPJ) {
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${formatCNPJ(clientCNPJ)}`, margin + 4, yPos + 21);
  }

  // Client address - use flat or nested
  const clientAddr = proposal.client_address || [
    proposal.opportunity?.account?.logradouro,
    proposal.opportunity?.account?.numero,
    proposal.opportunity?.account?.bairro,
  ].filter(Boolean).join(', ');
  
  if (clientAddr) {
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    const addrTruncated = clientAddr.substring(0, 35) + (clientAddr.length > 35 ? '...' : '');
    doc.text(addrTruncated, margin + 4, yPos + 28);
  }

  // Client city/state
  const clientLocation = proposal.client_city && proposal.client_state 
    ? `${proposal.client_city} - ${proposal.client_state}`
    : [proposal.opportunity?.account?.cidade, proposal.opportunity?.account?.uf].filter(Boolean).join(' - ');
  
  if (clientLocation) {
    doc.setFontSize(7);
    doc.text(clientLocation, margin + 4, yPos + 35);
  }

  // --- Contact card ---
  const contactCardX = margin + cardWidth + 5;
  doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
  doc.roundedRect(contactCardX, yPos, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTATO', contactCardX + 4, yPos + 7);

  // Use flat contact_name or nested
  const contactName = proposal.contact_name || proposal.opportunity?.contact?.nome || 'Não informado';
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(9);
  doc.text(contactName.substring(0, 25), contactCardX + 4, yPos + 14);

  // Contact cargo (nested only)
  if (proposal.opportunity?.contact?.cargo) {
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(proposal.opportunity.contact.cargo, contactCardX + 4, yPos + 21);
  }

  // Contact email - use flat or nested
  const contactEmail = proposal.contact_email || proposal.opportunity?.contact?.emails?.[0] || '';
  if (contactEmail) {
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.text(contactEmail.substring(0, 30), contactCardX + 4, yPos + 28);
  }

  // Contact phone - use flat or nested
  const contactPhone = proposal.contact_phone || proposal.opportunity?.contact?.telefones?.[0] || '';
  if (contactPhone) {
    doc.setFontSize(7);
    doc.text(formatPhone(contactPhone), contactCardX + 4, yPos + 35);
  }

  // --- Proposal Info card ---
  const proposalCardX = margin + (cardWidth * 2) + 10;
  doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
  doc.roundedRect(proposalCardX, yPos, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA', proposalCardX + 4, yPos + 7);

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(9);
  doc.text(proposalNum, proposalCardX + 4, yPos + 14);

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  
  if (proposal.created_at) {
    doc.text(`Criada: ${formatDateBR(proposal.created_at)}`, proposalCardX + 4, yPos + 21);
  }
  
  if (proposal.expires_at) {
    doc.text(`Validade: ${formatDateBR(proposal.expires_at)}`, proposalCardX + 4, yPos + 28);
  }

  // Payment method in proposal card
  const paymentMethodLabels: Record<string, string> = {
    'pix': 'PIX',
    'boleto': 'Boleto Bancário',
    'cartao': 'Cartão de Crédito',
    'transferencia': 'Transferência',
  };
  if (proposal.payment_method) {
    doc.text(`Pagto: ${paymentMethodLabels[proposal.payment_method] || proposal.payment_method}`, proposalCardX + 4, yPos + 35);
  }

  yPos += cardHeight + 12;

  // ===== INTRODUCTION SECTION =====
  const introText = stripHtml(proposal.introduction || '');
  if (introText) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('APRESENTAÇÃO', margin, yPos);
    yPos += 7;

    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const introLines = doc.splitTextToSize(introText, contentWidth);
    doc.text(introLines, margin, yPos);
    yPos += introLines.length * 4 + 10;
  }

  // Check if we need a new page before items
  if (yPos > pageHeight - 100) {
    doc.addPage();
    yPos = margin;
  }

  // ===== ITEMS SEPARATED BY TYPE (AVULSO vs RECORRENTE) =====
  const currency = proposal.currency || 'BRL';
  
  // Separate items by billing type
  const oneTimeItems = items.filter(item => (item.billing_type || 'one_time') !== 'recurring');
  const recurringItems = items.filter(item => item.billing_type === 'recurring');
  
  // Calculate totals by type
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
  const recurringMRR = recurringItems.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = oneTimeTotal + (recurringPayment?.contract_total || recurringMRR * (recurringPayment?.contract_months || 12));

  // Helper function to render items table
  const renderItemsTable = (tableItems: ProposalItem[], title: string, isRecurring: boolean) => {
    if (tableItems.length === 0) return;
    
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 5;

    const tableBody = tableItems.map(item => {
      const itemDesc = stripHtml(item.description || '');
      const itemNameWithDesc = itemDesc 
        ? `${item.name}\n${itemDesc.substring(0, 100)}${itemDesc.length > 100 ? '...' : ''}`
        : item.name;
      
      const unit = item.measurement_unit?.abbreviation || '';
      const qtyDisplay = unit ? `${item.quantity} ${unit}` : item.quantity.toString();
      const priceDisplay = isRecurring 
        ? `${formatCurrency(item.unit_price, currency)}/mês`
        : formatCurrency(item.unit_price, currency);
      const totalDisplay = isRecurring 
        ? `${formatCurrency(item.total, currency)}/mês`
        : formatCurrency(item.total, currency);
      
      return [
        itemNameWithDesc,
        qtyDisplay,
        priceDisplay,
        item.discount_percent ? `${item.discount_percent}%` : '-',
        totalDisplay,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [[
        { content: 'Item', styles: { halign: 'left' } },
        { content: 'Qtd', styles: { halign: 'center' } },
        { content: isRecurring ? 'Preço/Mês' : 'Preço Unit.', styles: { halign: 'right' } },
        { content: 'Desc.', styles: { halign: 'center' } },
        { content: 'Total', styles: { halign: 'right' } },
      ]],
      body: tableBody,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 4,
        lineColor: [borderColor.r, borderColor.g, borderColor.b],
        lineWidth: 0.1,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: isRecurring ? [22, 163, 74] : [primaryRgb.r, primaryRgb.g, primaryRgb.b],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [bgLight.r, bgLight.g, bgLight.b],
      },
      columnStyles: {
        0: { cellWidth: 'auto', valign: 'top' },
        1: { cellWidth: 18, halign: 'center', valign: 'middle' },
        2: { cellWidth: 30, halign: 'right', valign: 'middle' },
        3: { cellWidth: 15, halign: 'center', valign: 'middle' },
        4: { cellWidth: 35, halign: 'right', valign: 'middle' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  };

  // Render ONE-TIME items
  if (oneTimeItems.length > 0) {
    renderItemsTable(oneTimeItems, 'ITENS AVULSOS', false);
  }

  // Render RECURRING items
  if (recurringItems.length > 0) {
    // Check for new page
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }
    renderItemsTable(recurringItems, 'ITENS RECORRENTES (ASSINATURA)', true);
  }

  // ===== RESUMO DO INVESTIMENTO (World-Class Summary Box) =====
  if (items.length > 0) {
    // Check for new page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO DO INVESTIMENTO', margin, yPos);
    yPos += 6;

    // Summary box
    const summaryBoxHeight = recurringMRR > 0 ? 50 : 28;
    doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
    doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, yPos, contentWidth, summaryBoxHeight, 2, 2, 'FD');
    
    let lineY = yPos + 10;
    
    // One-time total
    if (oneTimeTotal > 0) {
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Total Avulso:', margin + 8, lineY);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(oneTimeTotal, currency), margin + contentWidth - 8, lineY, { align: 'right' });
      lineY += 8;
    }
    
    // MRR
    if (recurringMRR > 0 || (recurringPayment && recurringPayment.monthly_value > 0)) {
      const mrr = recurringPayment?.monthly_value || recurringMRR;
      const months = recurringPayment?.contract_months || 12;
      const contractTotal = recurringPayment?.contract_total || mrr * months;
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('MRR (Mensal):', margin + 8, lineY);
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(mrr, currency)}/mês`, margin + contentWidth - 8, lineY, { align: 'right' });
      lineY += 8;
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text(`Contrato (${months} meses):`, margin + 8, lineY);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(contractTotal, currency), margin + contentWidth - 8, lineY, { align: 'right' });
      lineY += 8;
    }
    
    // Divider line
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.setLineWidth(0.3);
    doc.line(margin + 8, lineY - 2, margin + contentWidth - 8, lineY - 2);
    
    // Grand total
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL DA PROPOSTA:', margin + 8, lineY + 6);
    doc.text(formatCurrency(grandTotal, currency), margin + contentWidth - 8, lineY + 6, { align: 'right' });
    
    yPos += summaryBoxHeight + 12;
  }


  // Check for new page before payment terms
  if (yPos > pageHeight - 80 && installments.length > 0) {
    doc.addPage();
    yPos = margin;
  }

  // ===== PAYMENT TERMS =====
  const hasPaymentTerms = installments.length > 0 || recurringPayment;
  
  if (hasPaymentTerms) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CONDIÇÕES DE PAGAMENTO', margin, yPos);
    yPos += 8;

    const currency = proposal.currency || 'BRL';

    // === AVULSO / ONE-TIME PAYMENTS ===
    if (installments.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text('Pagamento Avulso', margin, yPos);
      yPos += 6;

      // Payment Method
      if (proposal.payment_method) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text('Forma de Pagamento: ', margin, yPos);
        doc.setTextColor(textDark.r, textDark.g, textDark.b);
        doc.setFont('helvetica', 'bold');
        doc.text(paymentMethodLabels[proposal.payment_method] || proposal.payment_method, margin + 40, yPos);
        yPos += 6;
      }

      autoTable(doc, {
        startY: yPos,
        head: [[
          { content: 'Parcela', styles: { halign: 'left' } },
          { content: 'Vencimento', styles: { halign: 'center' } },
          { content: 'Valor', styles: { halign: 'right' } },
        ]],
        body: installments.map(inst => [
          inst.type === 'entry' ? 'Entrada' : `Parcela ${inst.number}`,
          formatDateBR(inst.dueDate),
          formatCurrency(inst.amount, currency),
        ]),
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [borderColor.r, borderColor.g, borderColor.b],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [primaryRgb.r, primaryRgb.g, primaryRgb.b],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [bgLight.r, bgLight.g, bgLight.b],
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 50, halign: 'center' },
          2: { cellWidth: 'auto', halign: 'right' },
        },
        margin: { left: margin, right: margin },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // === MRR / RECURRING PAYMENTS ===
    if (recurringPayment && recurringPayment.monthly_value > 0) {
      // Check for new page
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text('Pagamento Recorrente (MRR)', margin, yPos);
      yPos += 6;

      // Payment method for recurring
      if (recurringPayment.payment_method) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text('Forma de Pagamento: ', margin, yPos);
        doc.setTextColor(textDark.r, textDark.g, textDark.b);
        doc.setFont('helvetica', 'bold');
        doc.text(paymentMethodLabels[recurringPayment.payment_method] || recurringPayment.payment_method, margin + 40, yPos);
        yPos += 6;
      }

      // MRR Summary Box
      const mrrBoxY = yPos;
      doc.setFillColor(240, 253, 244); // Light green
      doc.roundedRect(margin, mrrBoxY, contentWidth, 28, 2, 2, 'F');
      
      const boxWidth = contentWidth / 3;
      
      // MRR
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('MRR (Mensal)', margin + boxWidth / 2, mrrBoxY + 8, { align: 'center' });
      doc.setTextColor(22, 163, 74); // Green
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(recurringPayment.monthly_value, currency), margin + boxWidth / 2, mrrBoxY + 18, { align: 'center' });
      
      // Contract Total
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Contrato (${recurringPayment.contract_months}m)`, margin + boxWidth + boxWidth / 2, mrrBoxY + 8, { align: 'center' });
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(recurringPayment.contract_total, currency), margin + boxWidth + boxWidth / 2, mrrBoxY + 18, { align: 'center' });
      
      // ARR
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('ARR (Anual)', margin + boxWidth * 2 + boxWidth / 2, mrrBoxY + 8, { align: 'center' });
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(recurringPayment.monthly_value * 12, currency), margin + boxWidth * 2 + boxWidth / 2, mrrBoxY + 18, { align: 'center' });
      
      yPos = mrrBoxY + 35;

      // Contract details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      
      const details = [];
      if (recurringPayment.first_payment_date) {
        details.push(`Início: ${formatDateBR(recurringPayment.first_payment_date)}`);
      }
      details.push(`Prazo: ${recurringPayment.contract_months} meses`);
      if (recurringPayment.billing_day) {
        details.push(`Vencimento: Dia ${recurringPayment.billing_day}`);
      }
      
      doc.text(details.join('  •  '), margin, yPos);
      yPos += 10;
    }
    
    yPos += 5;
  }

  // Check for new page before terms
  const termsContent = proposal.terms || proposal.terms_and_conditions || '';
  if (yPos > pageHeight - 60 && termsContent) {
    doc.addPage();
    yPos = margin;
  }

  // ===== TERMS & CONDITIONS =====
  const termsText = stripHtml(termsContent);
  if (termsText) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMOS E CONDIÇÕES', margin, yPos);
    yPos += 7;

    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    const termsLines = doc.splitTextToSize(termsText, contentWidth);
    
    // Check if we need pagination for terms
    const termsHeight = termsLines.length * 3.5;
    if (yPos + termsHeight > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.text(termsLines, margin, yPos);
    yPos += termsLines.length * 3.5 + 10;
  }

  // ===== NOTES / OBSERVATIONS =====
  const notesContent = proposal.notes || proposal.observations || '';
  const notesText = stripHtml(notesContent);
  if (notesText) {
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = margin;
    }

    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', margin, yPos);
    yPos += 7;

    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    const notesLines = doc.splitTextToSize(notesText, contentWidth);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 3.5 + 10;
  }

  // ===== CONTRACT ATTACHMENTS SECTION =====
  const layoutPages = proposal.layout?.pages || [];
  if (layoutPages.length > 0) {
    // Check if we need a new page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTOS ANEXOS AO CONTRATO', margin, yPos);
    yPos += 7;

    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Os seguintes documentos fazem parte integrante deste contrato:', margin, yPos);
    yPos += 8;

    layoutPages.forEach((page: any, idx: number) => {
      const pageTitle = page.file_name || `Documento ${idx + 1}`;
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.setFontSize(8);
      doc.text(`• ${pageTitle}`, margin + 4, yPos);
      
      if (page.file_url) {
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.setFontSize(7);
        // Add clickable link
        doc.textWithLink('(Ver documento)', margin + 8 + doc.getTextWidth(`• ${pageTitle}`), yPos, { url: page.file_url });
      }
      yPos += 5;
    });
    yPos += 5;
  }

  // ===== FOOTER ON ALL PAGES =====
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Footer background
    doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
    doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');
    
    // Seller contact info - use flat fields or nested
    const sellerName = proposal.seller_name || proposal.seller_profile?.full_name;
    const sellerEmail = proposal.seller_email || proposal.seller_profile?.email;
    const sellerPhone = proposal.seller_phone || proposal.seller_profile?.phone;
    
    if (sellerName || sellerEmail || sellerPhone) {
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Dúvidas? Fale com seu consultor:', margin, pageHeight - 17);
      
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(9);
      const sellerInfo = [
        sellerName,
        sellerPhone ? formatPhone(sellerPhone) : '',
        sellerEmail,
      ].filter(Boolean).join(' • ');
      doc.text(sellerInfo, margin, pageHeight - 11);
    }

    // Page number
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 11, { align: 'right' });

    // Generation timestamp
    doc.setFontSize(7);
    const timestamp = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em ${timestamp}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  // Return as blob
  return doc.output('blob');
}

// Helper to download the PDF
export async function downloadProposalPDF(
  proposal: ProposalData,
  items: ProposalItem[],
  installments: PaymentInstallment[],
  recurringPayment?: RecurringPaymentData
): Promise<void> {
  const blob = await generateProposalPDFClient(proposal, items, installments, recurringPayment);
  
  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `proposta-${proposal.proposal_number || proposal.id?.slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
