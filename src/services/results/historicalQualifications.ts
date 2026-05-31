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
 *   - Fallback: `owner_user_id` atual da oportunidade.
 */
import { supabase } from '@/integrations/supabase/client';

export interface HistoricalQualifierCount {
  qualifierUserId: string;
  qualifiedLeads: number;
}

export interface QualifiedOpportunity {
  opportunityId: string;
  title: string;
  accountName: string | null;
  pipelineName: string | null;
  pipelineId: string | null;
  stageName: string | null;
  origem: string | null;
  status: string;
  closedAt: string | null;
  qualificationAt: string | null;
  historicalQualifierUserId: string | null;
  historicalQualifierName: string | null;
  currentOwnerUserId: string | null;
  currentOwnerName: string | null;
  valueWon: number | null;
}

interface OppRow {
  id: string;
  title: string;
  status: string;
  closed_at: string | null;
  owner_user_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  origem: string | null;
  valor_previsto: number | null;
  accounts?: { nome_fantasia: string | null; razao_social: string | null } | null;
  pipelines?: { id: string; name: string | null; pipeline_type: string | null } | null;
  stages?: { name: string | null } | null;
}

interface HistRow {
  opportunity_id: string;
  qualified_by_user_id: string | null;
  qualification_at: string;
}

async function fetchQualifiedOppsRaw(params: {
  organizationId: string;
  start: string;
  end: string;
}) {
  const { data: opps, error: oppsErr } = await (supabase as any)
    .from('opportunities')
    .select(`
      id, title, status, closed_at, owner_user_id, pipeline_id, stage_id, origem, valor_previsto,
      accounts ( nome_fantasia, razao_social ),
      pipelines!inner ( id, name, pipeline_type ),
      stages ( name )
    `)
    .eq('organization_id', params.organizationId)
    .eq('status', 'won')
    .is('deleted_at', null)
    .gte('closed_at', params.start)
    .lte('closed_at', params.end)
    .eq('pipelines.pipeline_type', 'qualification');
  if (oppsErr) throw oppsErr;

  const oppList = (opps ?? []) as OppRow[];
  if (oppList.length === 0) return { oppList, firstQualByOpp: new Map<string, { user: string | null; at: string }>() };

  const oppIds = oppList.map((o) => o.id);
  const { data: hist, error: histErr } = await (supabase as any)
    .from('opportunity_qualification_history')
    .select('opportunity_id, qualified_by_user_id, qualification_at')
    .eq('organization_id', params.organizationId)
    .in('opportunity_id', oppIds);
  if (histErr) throw histErr;

  const firstQualByOpp = new Map<string, { user: string | null; at: string }>();
  for (const row of (hist ?? []) as HistRow[]) {
    const cur = firstQualByOpp.get(row.opportunity_id);
    if (!cur || new Date(row.qualification_at) < new Date(cur.at)) {
      firstQualByOpp.set(row.opportunity_id, { user: row.qualified_by_user_id, at: row.qualification_at });
    }
  }
  return { oppList, firstQualByOpp };
}

export async function getHistoricalQualifiersInPeriod(params: {
  organizationId: string;
  start: string;
  end: string;
}): Promise<HistoricalQualifierCount[]> {
  const { oppList, firstQualByOpp } = await fetchQualifiedOppsRaw(params);
  const counts = new Map<string, number>();
  for (const opp of oppList) {
    const histUser = firstQualByOpp.get(opp.id)?.user ?? null;
    const userId = histUser || opp.owner_user_id;
    if (!userId) continue;
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([qualifierUserId, qualifiedLeads]) => ({ qualifierUserId, qualifiedLeads }))
    .sort((a, b) => b.qualifiedLeads - a.qualifiedLeads);
}

/**
 * Retorna a lista de oportunidades qualificadas no período, atribuídas
 * historicamente ao `userId` (mesma regra do contador da Visão Geral).
 */
export async function getQualifiedOpportunitiesByUser(params: {
  organizationId: string;
  userId: string;
  start: string;
  end: string;
}): Promise<QualifiedOpportunity[]> {
  const { oppList, firstQualByOpp } = await fetchQualifiedOppsRaw({
    organizationId: params.organizationId,
    start: params.start,
    end: params.end,
  });

  // Filtra pela atribuição histórica do usuário (fallback: owner atual).
  const ofUser = oppList.filter((opp) => {
    const histUser = firstQualByOpp.get(opp.id)?.user ?? null;
    const attributed = histUser || opp.owner_user_id;
    return attributed === params.userId;
  });
  if (ofUser.length === 0) return [];

  // Resolve nomes (qualifier histórico + owner atual) em uma única consulta.
  const userIdsToResolve = new Set<string>();
  for (const opp of ofUser) {
    const histUser = firstQualByOpp.get(opp.id)?.user ?? null;
    if (histUser) userIdsToResolve.add(histUser);
    if (opp.owner_user_id) userIdsToResolve.add(opp.owner_user_id);
  }
  let profileMap = new Map<string, string>();
  if (userIdsToResolve.size > 0) {
    const { data: profs } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(userIdsToResolve));
    profileMap = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name || '']));
  }

  return ofUser
    .map((opp): QualifiedOpportunity => {
      const histInfo = firstQualByOpp.get(opp.id);
      const histUser = histInfo?.user ?? null;
      const acct = opp.accounts;
      const accountName = acct?.nome_fantasia || acct?.razao_social || null;
      return {
        opportunityId: opp.id,
        title: opp.title,
        accountName,
        pipelineName: opp.pipelines?.name ?? null,
        pipelineId: opp.pipelines?.id ?? null,
        stageName: opp.stages?.name ?? null,
        origem: opp.origem ?? null,
        status: opp.status,
        closedAt: opp.closed_at,
        qualificationAt: histInfo?.at ?? null,
        historicalQualifierUserId: histUser,
        historicalQualifierName: histUser ? (profileMap.get(histUser) || null) : null,
        currentOwnerUserId: opp.owner_user_id,
        currentOwnerName: opp.owner_user_id ? (profileMap.get(opp.owner_user_id) || null) : null,
        valueWon: opp.valor_previsto != null ? Number(opp.valor_previsto) : null,
      };
    })
    .sort((a, b) => {
      const da = a.qualificationAt ? new Date(a.qualificationAt).getTime() : 0;
      const db = b.qualificationAt ? new Date(b.qualificationAt).getTime() : 0;
      return db - da;
    });
}
