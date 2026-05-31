/**
 * Sprint OTE — Atribuição Histórica de Pré-vendas.
 *
 * Fonte ÚNICA para "Leads Qualificados" do OTE Pré-vendas.
 *
 * Regra (alinhada ao Win/Loss Hub e ao detalhe Por Vendedor):
 *   Lead qualificado = oportunidade em pipeline `pipeline_type='qualification'`
 *   com `status='won'` e `closed_at` dentro do período, NÃO soft-deletada.
 *
 * Atribuição histórica:
 *   - Pré-venda responsável = primeiro `qualified_by_user_id` em
 *     `opportunity_qualification_history` (mais antigo) para a oportunidade.
 *   - Fallback: `owner_user_id` atual da oportunidade (marcado como
 *     `attribution_source='current_owner_fallback'`).
 *
 * NUNCA usar:
 *   - `opportunity_qualification_history` sem filtro de pipeline/status (inflado
 *     por requalificações e por outros pipelines de qualificação).
 *   - `owner_user_id` atual como base primária (transferência operacional
 *     altera o relatório histórico).
 */
import { supabase } from '@/integrations/supabase/client';

export interface HistoricalQualifierCount {
  qualifierUserId: string;
  qualifiedLeads: number;
}

interface OppRow {
  id: string;
  owner_user_id: string | null;
  closed_at: string | null;
  pipelines?: { pipeline_type: string | null } | null;
}

interface HistRow {
  opportunity_id: string;
  qualified_by_user_id: string | null;
  qualification_at: string;
}

export async function getHistoricalQualifiersInPeriod(params: {
  organizationId: string;
  start: string; // ISO
  end: string;   // ISO
}): Promise<HistoricalQualifierCount[]> {
  // 1. Oportunidades GANHAS em pipeline de qualificação, fechadas no período.
  const { data: opps, error: oppsErr } = await (supabase as any)
    .from('opportunities')
    .select('id, owner_user_id, closed_at, pipelines!inner(pipeline_type)')
    .eq('organization_id', params.organizationId)
    .eq('status', 'won')
    .is('deleted_at', null)
    .gte('closed_at', params.start)
    .lte('closed_at', params.end)
    .eq('pipelines.pipeline_type', 'qualification');
  if (oppsErr) throw oppsErr;

  const oppList = (opps ?? []) as OppRow[];
  if (oppList.length === 0) return [];
  const oppIds = oppList.map((o) => o.id);

  // 2. Histórico de qualificações para resolver SDR histórico (primeiro qualificador).
  const { data: hist, error: histErr } = await (supabase as any)
    .from('opportunity_qualification_history')
    .select('opportunity_id, qualified_by_user_id, qualification_at')
    .eq('organization_id', params.organizationId)
    .in('opportunity_id', oppIds);
  if (histErr) throw histErr;

  const firstByOpp = new Map<string, { user: string | null; at: string }>();
  for (const row of (hist ?? []) as HistRow[]) {
    const cur = firstByOpp.get(row.opportunity_id);
    if (!cur || new Date(row.qualification_at) < new Date(cur.at)) {
      firstByOpp.set(row.opportunity_id, { user: row.qualified_by_user_id, at: row.qualification_at });
    }
  }

  // 3. Contagem por SDR histórico (fallback: owner_user_id atual).
  const counts = new Map<string, number>();
  for (const opp of oppList) {
    const histUser = firstByOpp.get(opp.id)?.user ?? null;
    const userId = histUser || opp.owner_user_id;
    if (!userId) continue;
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([qualifierUserId, qualifiedLeads]) => ({ qualifierUserId, qualifiedLeads }))
    .sort((a, b) => b.qualifiedLeads - a.qualifiedLeads);
}
