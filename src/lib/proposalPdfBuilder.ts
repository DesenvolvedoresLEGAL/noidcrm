import { ProposalItem } from '@/services/crm/proposal-items';
import { PaymentTerm, calculateInstallments } from '@/services/crm/proposal-payment-terms';
import { dynamicPricingEndForInstallments } from '@/lib/proposals/resolvePaymentDueDate';
import { extractEmail, extractPhone } from '@/lib/contactFormat';

export interface ProposalPDFData {
  id: string;
  proposal_number: string;
  title: string;
  client_name: string;
  client_document: string;
  client_address: string;
  client_city: string;
  client_state: string;
  client_zip: string;
  contact_name: string;
  contact_cargo: string;
  contact_email: string;
  contact_phone: string;
  seller_name: string;
  seller_email: string;
  seller_phone: string;
  introduction: string;
  terms_and_conditions: string;
  observations: string;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  validity_days: number;
  expires_at: string;
  created_at: string;
  organization: any;
  layout: any;
  payment_method: string;
  dynamic_pricing_enabled?: boolean;
  dynamic_pricing_snapshot?: any;
}

// Match the PaymentInstallment interface from proposalPdfGenerator.ts
export interface PaymentInstallment {
  number: number;
  dueDate: string;
  amount: number;
  type: 'upfront' | 'entry' | 'balance' | 'installment';
  label?: string;
}

export interface RecurringPaymentData {
  monthly_value: number;
  contract_months: number;
  contract_total: number;
  first_payment_date?: string;
  billing_day?: number;
  payment_method?: string;
}

/**
 * Builds standardized PDF data from a proposal with all relationships loaded
 * Use with getProposalWithDetails() which fetches organization, account, contact, and seller_profile
 */
export function buildProposalPDFData(
  proposal: any,
  items: ProposalItem[],
  paymentTerms: PaymentTerm[]
): { pdfData: ProposalPDFData; pdfItems: any[]; installments: PaymentInstallment[]; recurringPayment?: RecurringPaymentData } {
  const account = proposal.opportunity?.account;
  const contact = proposal.opportunity?.contact;
  const org = proposal.organization;
  const seller = proposal.seller_profile;
  
  const oneTimeTerm = paymentTerms.find(t => t.payment_type === 'one_time');
  const recurringTerm = paymentTerms.find(t => t.payment_type === 'recurring');

  // Get payment discount from one_time term
  const paymentDiscountPercent = oneTimeTerm?.discount_percent || 0;

  // Separate items by billing type
  const oneTimeItems = items.filter(item => ((item as any).billing_type || 'one_time') !== 'recurring');
  const recurringItems = items.filter(item => (item as any).billing_type === 'recurring');

  // Calculate totals by type
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const recurringMRR = recurringItems.reduce((sum, item) => sum + (item.total || 0), 0);

  const dpSnap: any = (proposal as any)?.dynamic_pricing_snapshot ?? null;
  const dynamicOneTimeAmount =
    (proposal as any)?.dynamic_pricing_enabled && dpSnap?.current_amount != null
      ? Number(dpSnap.current_amount)
      : null;

  // Apply payment discount to one-time total
  const paymentDiscountAmount = oneTimeTotal * (paymentDiscountPercent / 100);
  const oneTimeWithDiscount = oneTimeTotal - paymentDiscountAmount;
  const effectiveOneTimeAmount = dynamicOneTimeAmount ?? oneTimeWithDiscount;

  // Calculate contract total for recurring
  const contractMonths = (recurringTerm as any)?.contract_months || recurringTerm?.contract_duration_months || 12;
  const recurringContractTotal = recurringMRR * contractMonths;

  // Grand total with discount applied
  const calculatedTotal = effectiveOneTimeAmount + recurringContractTotal;

  // Calculate totals from items if not set on proposal (legacy fallback)
  const calculatedSubtotal = items.reduce((sum, item) => 
    sum + ((item.unit_price || 0) * (item.quantity || 1)), 0);
  const calculatedDiscount = calculatedSubtotal - calculatedTotal;

  // Build client address
  const clientAddress = account 
    ? [account.logradouro, account.numero, account.bairro].filter(Boolean).join(', ')
    : '';

  const pdfData: ProposalPDFData = {
    id: proposal.id,
    proposal_number: proposal.proposal_number || '',
    title: proposal.title || proposal.opportunity?.title || '',
    client_name: account?.nome_fantasia || account?.razao_social || proposal.client_name || '',
    client_document: account?.cnpj || '',
    client_address: clientAddress,
    client_city: account?.cidade || '',
    client_state: account?.uf || '',
    client_zip: account?.cep || '',
    contact_name: contact?.nome || '',
    contact_cargo: contact?.cargo || '',
    contact_email: extractEmail(contact?.emails) || '',
    contact_phone: extractPhone(contact?.telefones) || '',
    seller_name: seller?.full_name || '',
    seller_email: seller?.email || '',
    seller_phone: seller?.phone || '',
    introduction: proposal.introduction || '',
    terms_and_conditions: proposal.terms || '',
    observations: proposal.notes || '',
    subtotal: proposal.subtotal || calculatedSubtotal,
    discount_percent: paymentDiscountPercent,
    discount_amount: paymentDiscountAmount,
    total_amount: calculatedTotal,
    currency: proposal.currency || 'BRL',
    validity_days: proposal.validity_days || 30,
    expires_at: proposal.expires_at || '',
    created_at: proposal.created_at || '',
    organization: org || null,
    layout: proposal.layout || null,
    payment_method: oneTimeTerm?.payment_method || recurringTerm?.payment_method || '',
    dynamic_pricing_enabled: !!proposal.dynamic_pricing_enabled,
    dynamic_pricing_snapshot: proposal.dynamic_pricing_snapshot ?? null,
  };

  // Build items for PDF with billing_type for separation
  const pdfItems = items.map(item => ({
    name: item.name || '',
    description: item.description || '',
    quantity: item.quantity || 1,
    unit_cost: item.unit_cost || 0,
    markup_percent: item.markup_percent || 0,
    unit_price: item.unit_price || 0,
    discount_percent: item.discount_percent || 0,
    total: item.total || 0,
    billing_type: (item as any).billing_type || 'one_time',
  }));

  // Calculate installments via central calculator (PRICE UX 1.0.3)
  // Garante: rótulos corretos (À vista / Entrada / Saldo / Parcela N)
  // e vencimento do à vista atrelado à tabela dinâmica vigente.
  const installments: PaymentInstallment[] = [];
  if (oneTimeTerm) {
    const isAccepted = proposal?.status === 'accepted';
    const calc = calculateInstallments(oneTimeTerm, effectiveOneTimeAmount, {
      proposalExpiresAt: proposal?.expires_at ?? null,
      approvedAmount: isAccepted ? Number(proposal?.approved_amount ?? effectiveOneTimeAmount) : null,
      dynamicPricingCurrentEndsAt: dynamicPricingEndForInstallments(
        proposal,
        oneTimeTerm,
        { snapshot: dpSnap },
      ),
    });
    for (const inst of calc) {
      installments.push({
        number: inst.number,
        dueDate: inst.dueDate,
        amount: inst.amount,
        type: inst.type,
        label: inst.label,
      });
    }
  }

  // Build recurring payment data
  const recurringPayment: RecurringPaymentData | undefined = recurringTerm ? {
    monthly_value: recurringTerm.monthly_value || 0,
    contract_months: (recurringTerm as any).contract_months || recurringTerm.contract_duration_months || 12,
    contract_total: recurringTerm.contract_total || (recurringTerm.monthly_value || 0) * ((recurringTerm as any).contract_months || 12),
    first_payment_date: recurringTerm.first_payment_date || recurringTerm.contract_start_date,
    billing_day: recurringTerm.billing_day || (recurringTerm as any).recurring_due_day || 10,
    payment_method: recurringTerm.payment_method,
  } : undefined;

  return { pdfData, pdfItems, installments, recurringPayment };
}
