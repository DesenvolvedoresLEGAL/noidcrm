import { supabase } from '@/integrations/supabase/client';

const c = supabase as any;

export interface OrchestrationResult {
  ok: boolean;
  reason?: string;
  total_amount?: number;
  one_time_total?: number;
  recurring_total?: number;
  is_event?: boolean;
  is_recurring?: boolean;
  dynamic_result?: any;
  snapshot?: any;
  error?: string;
}

/**
 * Centraliza orquestração financeira de uma proposta:
 * - Recalcula totais a partir de itens
 * - Garante condição financeira padrão (Pix à vista) para Evento
 * - Gera/regenera tabela dinâmica por antecedência da validade
 * - Atualiza snapshot e valor vigente
 */
export async function orchestrateProposalFinancials(
  proposalId: string,
  reason: string = 'manual',
): Promise<OrchestrationResult> {
  const { data, error } = await c.rpc('orchestrate_proposal_financials', {
    p_proposal_id: proposalId,
    p_reason: reason,
  });
  if (error) {
    console.error('[orchestrateProposalFinancials] error:', error);
    return { ok: false, error: error.message };
  }

  // PRICE CORE 2.0 — also refresh the pricing ledger snapshot so the
  // "Composição do valor" breakdown (editor + public link + PDF inputs)
  // reflects current items / dynamic tier / payment terms. The RPC is
  // idempotent and is a no-op on frozen accepted proposals.
  try {
    await c.rpc('ensure_proposal_pricing_ready', { p_proposal_id: proposalId });
  } catch (e) {
    console.warn('[orchestrateProposalFinancials] ledger refresh failed:', e);
  }

  return data as OrchestrationResult;
}
