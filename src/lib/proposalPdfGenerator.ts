import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateBR } from './dateUtils';

interface ProposalItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  total: number;
}

interface PaymentInstallment {
  number: number;
  dueDate: string;
  amount: number;
  type: 'entry' | 'installment';
}

interface ProposalData {
  id: string;
  proposal_number?: string;
  proposal_version?: number;
  title?: string;
  client_name?: string;
  expires_at?: string;
  introduction?: string;
  terms?: string;
  notes?: string;
  currency?: string;
  total_amount?: number;
  subtotal?: number;
  status?: string;
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
  installments: PaymentInstallment[]
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
  const contactInfo = [
    proposal.organization?.phone ? formatPhone(proposal.organization.phone) : '',
    proposal.organization?.email || '',
  ].filter(Boolean).join(' • ');
  
  if (contactInfo) {
    doc.setFontSize(8);
    doc.text(contactInfo, margin, 37);
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

  // ===== CLIENT & CONTACT CARDS =====
  const cardWidth = (contentWidth - 10) / 2;
  const cardHeight = 35;

  // Client card
  doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
  doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
  doc.roundedRect(margin, yPos, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', margin + 5, yPos + 7);

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(10);
  const clientName = proposal.client_name || 
    proposal.opportunity?.account?.nome_fantasia || 
    proposal.opportunity?.account?.razao_social || 
    'Cliente';
  doc.text(clientName, margin + 5, yPos + 15);

  if (proposal.opportunity?.account?.cnpj) {
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${formatCNPJ(proposal.opportunity.account.cnpj)}`, margin + 5, yPos + 22);
  }

  const clientLocation = [
    proposal.opportunity?.account?.cidade,
    proposal.opportunity?.account?.uf
  ].filter(Boolean).join(', ');
  
  if (clientLocation) {
    doc.setFontSize(8);
    doc.text(clientLocation, margin + 5, yPos + 29);
  }

  // Contact card
  doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
  doc.roundedRect(margin + cardWidth + 10, yPos, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTATO', margin + cardWidth + 15, yPos + 7);

  const contactName = proposal.opportunity?.contact?.nome || 'Não informado';
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(10);
  doc.text(contactName, margin + cardWidth + 15, yPos + 15);

  if (proposal.opportunity?.contact?.cargo) {
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(proposal.opportunity.contact.cargo, margin + cardWidth + 15, yPos + 22);
  }

  const contactEmail = proposal.opportunity?.contact?.emails?.[0] || '';
  const contactPhone = proposal.opportunity?.contact?.telefones?.[0] || '';
  if (contactEmail || contactPhone) {
    doc.setFontSize(8);
    doc.text([contactEmail, contactPhone ? formatPhone(contactPhone) : ''].filter(Boolean).join(' • '), margin + cardWidth + 15, yPos + 29);
  }

  yPos += cardHeight + 15;

  // ===== INTRODUCTION SECTION =====
  if (proposal.introduction) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('APRESENTAÇÃO', margin, yPos);
    yPos += 7;

    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const introText = stripHtml(proposal.introduction);
    const introLines = doc.splitTextToSize(introText, contentWidth);
    doc.text(introLines, margin, yPos);
    yPos += introLines.length * 4 + 10;
  }

  // Check if we need a new page before items
  if (yPos > pageHeight - 100) {
    doc.addPage();
    yPos = margin;
  }

  // ===== ITEMS TABLE =====
  if (items.length > 0) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ITENS DA PROPOSTA', margin, yPos);
    yPos += 5;

    const currency = proposal.currency || 'BRL';
    
    autoTable(doc, {
      startY: yPos,
      head: [[
        { content: 'Item', styles: { halign: 'left' } },
        { content: 'Qtd', styles: { halign: 'center' } },
        { content: 'Preço Unit.', styles: { halign: 'right' } },
        { content: 'Desc.', styles: { halign: 'center' } },
        { content: 'Total', styles: { halign: 'right' } },
      ]],
      body: items.map(item => [
        item.name,
        item.quantity.toString(),
        formatCurrency(item.unit_price, currency),
        item.discount_percent ? `${item.discount_percent}%` : '-',
        formatCurrency(item.total, currency),
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
        0: { cellWidth: 'auto' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Totals
    const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => {
      const itemSubtotal = item.unit_price * item.quantity;
      return sum + (itemSubtotal - item.total);
    }, 0);
    const total = items.reduce((sum, item) => sum + item.total, 0);

    // Totals box
    const totalsX = pageWidth - margin - 70;
    doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
    doc.roundedRect(totalsX, yPos, 70, 30, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Subtotal:', totalsX + 5, yPos + 8);
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(formatCurrency(subtotal, currency), totalsX + 65, yPos + 8, { align: 'right' });

    if (totalDiscount > 0) {
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text('Desconto:', totalsX + 5, yPos + 15);
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`-${formatCurrency(totalDiscount, currency)}`, totalsX + 65, yPos + 15, { align: 'right' });
    }

    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.line(totalsX + 5, yPos + 19, totalsX + 65, yPos + 19);

    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalsX + 5, yPos + 26);
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.text(formatCurrency(total, currency), totalsX + 65, yPos + 26, { align: 'right' });

    yPos += 40;
  }

  // Check for new page before payment terms
  if (yPos > pageHeight - 80 && installments.length > 0) {
    doc.addPage();
    yPos = margin;
  }

  // ===== PAYMENT TERMS =====
  if (installments.length > 0) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CONDIÇÕES DE PAGAMENTO', margin, yPos);
    yPos += 5;

    const currency = proposal.currency || 'BRL';

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

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check for new page before terms
  if (yPos > pageHeight - 60 && proposal.terms) {
    doc.addPage();
    yPos = margin;
  }

  // ===== TERMS & CONDITIONS =====
  if (proposal.terms) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMOS E CONDIÇÕES', margin, yPos);
    yPos += 7;

    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    const termsText = stripHtml(proposal.terms);
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

  // ===== NOTES =====
  if (proposal.notes) {
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
    
    const notesText = stripHtml(proposal.notes);
    const notesLines = doc.splitTextToSize(notesText, contentWidth);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 3.5 + 10;
  }

  // ===== FOOTER ON ALL PAGES =====
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Footer background
    doc.setFillColor(bgLight.r, bgLight.g, bgLight.b);
    doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');
    
    // Seller contact info
    if (proposal.seller_profile) {
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Dúvidas? Fale com seu consultor:', margin, pageHeight - 17);
      
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(9);
      const sellerInfo = [
        proposal.seller_profile.full_name,
        proposal.seller_profile.phone ? formatPhone(proposal.seller_profile.phone) : '',
        proposal.seller_profile.email,
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
  installments: PaymentInstallment[]
): Promise<void> {
  const blob = await generateProposalPDFClient(proposal, items, installments);
  
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
