/**
 * Sprint OTE — Atribuição Histórica de Pré-vendas.
 *
 * Conta leads qualificados por SDR histórico (quem qualificou pela primeira
 * vez) no período, lendo `opportunity_qualification_history`. Não usar
 * `owner_user_id` atual.
 */
import { supabase } from '@/integrations/supabase/client';

export interface HistoricalQualifierCount {
  qualifierUserId: string;
  qualifiedLeads: number;
}

export async function getHistoricalQualifiersInPeriod(params: {
  organizationId: string;
  start: string; // ISO
  end: string;   // ISO
}): Promise<HistoricalQualifierCount[]> {
  const { data, error } = await (supabase as any)
    .from('opportunity_qualification_history')
    .select('qualified_by_user_id, opportunity_id, qualification_at')
    .eq('organization_id', params.organizationId)
    .gte('qualification_at', params.start)
    .lte('qualification_at', params.end);
  if (error) throw error;

  // Para cada oportunidade, só a PRIMEIRA qualificação conta (SDR histórico).
  const firstByOpp = new Map<string, { user: string | null; at: string }>();
  for (const row of (data ?? []) as Array<{ qualified_by_user_id: string | null; opportunity_id: string; qualification_at: string }>) {
    const cur = firstByOpp.get(row.opportunity_id);
    if (!cur || new Date(row.qualification_at) < new Date(cur.at)) {
      firstByOpp.set(row.opportunity_id, { user: row.qualified_by_user_id, at: row.qualification_at });
    }
  }
  const counts = new Map<string, number>();
  for (const { user } of firstByOpp.values()) {
    if (!user) continue;
    counts.set(user, (counts.get(user) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([qualifierUserId, qualifiedLeads]) => ({ qualifierUserId, qualifiedLeads }))
    .sort((a, b) => b.qualifiedLeads - a.qualifiedLeads);
}
