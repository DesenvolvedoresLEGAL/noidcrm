import { supabase } from '@/integrations/supabase/client';
import type {
  PaymentEventType,
  PaymentIntentSource,
  PaymentIntentStatus,
  PaymentMethod,
} from '@/lib/proposals/proposalPayments';

const c = supabase as any;

export interface ProposalPaymentIntent {
  id: string;
  organization_id: string;
  proposal_id: string;
  dynamic_pricing_rule_id: string | null;
  dynamic_pricing_tier_id: string | null;
  source: PaymentIntentSource;
  expected_amount: number;
  paid_amount: number;
  difference_amount: number;
  currency: string;
  status: PaymentIntentStatus;
  payment_method: PaymentMethod;
  erp_invoice_id: string | null;
  erp_charge_id: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  expires_at: string | null;
  paid_at: string | null;
  dynamic_pricing_snapshot: Record<string, unknown>;
  payment_gateway_snapshot: Record<string, unknown>;
  notes: string | null;
  parent_payment_intent_id: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalPaymentEvent {
  id: string;
  organization_id: string;
  proposal_id: string;
  payment_intent_id: string | null;
  event_type: PaymentEventType;
  expected_amount: number | null;
  paid_amount: number | null;
  difference_amount: number | null;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function listPaymentIntents(
  proposalId: string,
): Promise<ProposalPaymentIntent[]> {
  const { data, error } = await c
    .from('proposal_payment_intents')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProposalPaymentIntent[];
}

export async function getLatestPaymentIntent(
  proposalId: string,
): Promise<ProposalPaymentIntent | null> {
  const { data, error } = await c
    .from('proposal_payment_intents')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ProposalPaymentIntent | null;
}

export async function listPaymentEvents(
  proposalId: string,
  limit = 30,
): Promise<ProposalPaymentEvent[]> {
  const { data, error } = await c
    .from('proposal_payment_events')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ProposalPaymentEvent[];
}

export async function createPaymentIntent(
  proposalId: string,
  source: PaymentIntentSource = 'proposal_link',
): Promise<{
  ok: boolean;
  payment_intent_id?: string;
  expected_amount?: number;
  status?: string;
  message?: string;
}> {
  const { data, error } = await c.rpc('create_proposal_payment_intent', {
    p_proposal_id: proposalId,
    p_source: source,
  });
  if (error) throw error;
  return data as any;
}

export async function validateManualPayment(
  paymentIntentId: string,
  paidAmount: number,
  paidAt: string,
  paymentReference?: string | null,
): Promise<{
  ok: boolean;
  expected_amount: number;
  paid_amount: number;
  difference_amount: number;
  status: PaymentIntentStatus;
}> {
  const { data, error } = await c.rpc('validate_proposal_payment_amount', {
    p_payment_intent_id: paymentIntentId,
    p_paid_amount: paidAmount,
    p_paid_at: paidAt,
    p_payment_reference: paymentReference ?? null,
  });
  if (error) throw error;
  return data as any;
}

export async function createComplementaryIntent(
  originalPaymentIntentId: string,
): Promise<{
  ok: boolean;
  complementary_payment_intent_id?: string;
  difference_amount?: number;
  message?: string;
}> {
  const { data, error } = await c.rpc('create_complementary_payment_intent', {
    p_original_payment_intent_id: originalPaymentIntentId,
  });
  if (error) throw error;
  return data as any;
}

export async function expireOldIntents(): Promise<number> {
  const { data, error } = await c.rpc('expire_old_payment_intents');
  if (error) throw error;
  return Number(data ?? 0);
}
