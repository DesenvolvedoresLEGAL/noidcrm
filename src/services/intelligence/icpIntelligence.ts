// ICP Intelligence Engine — KAI.12
// Calcula clusters de ICP a partir da base real de clientes (accounts + commercial_won_revenue_view).
// 100% read-only, sem dependência do módulo Roleplay.

import { supabase } from '@/integrations/supabase/client';
import { normalizeSegmento } from '@/lib/segment-normalizer';

export interface IntelligenceICP {
  id: string;                  // ex: "expositores__premium"
  name: string;                // ex: "Expositores Premium"
  segment: string;             // segmento dominante normalizado
  tier: 'premium' | 'standard' | 'recurring' | 'one_shot';
  count: number;               // nº de clientes únicos no cluster
  totalRevenue: number;        // soma de valid_revenue_amount
  avgTicket: number;           // média por deal ganho
  ltv: number;                 // receita acumulada média por cliente
  repurchaseRate: number;      // % de clientes com ≥2 deals ganhos
  wonDeals: number;            // nº de deals ganhos no cluster
  topCities: Array<{ city: string; count: number }>;
  topStates: Array<{ state: string; count: number }>;
  filterHints: {               // hints p/ preencher LeadSearchForm
    segment?: string;
    city?: string;
    state?: string;
  };
}

interface AccountRow {
  id: string;
  segmento: string | null;
  cidade: string | null;
  uf: string | null;
  tipo_empresa: string | null;
  data_tornou_cliente: string | null;
  deleted_at: string | null;
}

interface WonRow {
  account_id: string | null;
  valid_revenue_amount: number | null;
  is_cancelled_sale: boolean | null;
}

function tierLabel(tier: IntelligenceICP['tier']): string {
  switch (tier) {
    case 'premium': return 'Premium';
    case 'standard': return 'Standard';
    case 'recurring': return 'Recorrentes';
    case 'one_shot': return 'One-shot';
  }
}

function topBy<T extends string>(values: Array<T | null | undefined>, limit = 3): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const v of values) {
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function computeIcpIntelligence(organizationId: string): Promise<IntelligenceICP[]> {
  // 1. Buscar todas as contas vivas da organização
  const { data: accountsData, error: accErr } = await supabase
    .from('accounts')
    .select('id, segmento, cidade, uf, tipo_empresa, data_tornou_cliente, deleted_at')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .limit(5000);
  if (accErr) throw accErr;
  const accounts = (accountsData ?? []) as AccountRow[];
  const accountById = new Map(accounts.map(a => [a.id, a]));

  // 2. Buscar receita ganha (SSoT)
  const { data: wonData, error: wonErr } = await supabase
    .from('commercial_won_revenue_view' as any)
    .select('account_id, valid_revenue_amount, is_cancelled_sale')
    .eq('organization_id', organizationId)
    .limit(10000);
  if (wonErr) throw wonErr;
  const won = ((wonData ?? []) as WonRow[]).filter(r => r.account_id && !r.is_cancelled_sale);

  // 3. Agregar por conta
  interface AccAgg {
    accountId: string;
    revenue: number;
    deals: number;
  }
  const perAccount = new Map<string, AccAgg>();
  for (const row of won) {
    const id = row.account_id!;
    const cur = perAccount.get(id) ?? { accountId: id, revenue: 0, deals: 0 };
    cur.revenue += Number(row.valid_revenue_amount ?? 0);
    cur.deals += 1;
    perAccount.set(id, cur);
  }

  if (perAccount.size === 0) return [];

  // 4. Agrupar por segmento normalizado
  interface SegBucket {
    segment: string;
    items: Array<AccAgg & { account: AccountRow }>;
  }
  const buckets = new Map<string, SegBucket>();
  for (const agg of perAccount.values()) {
    const account = accountById.get(agg.accountId);
    if (!account) continue;
    const seg = normalizeSegmento(account.segmento) ?? 'Sem segmento';
    const bucket = buckets.get(seg) ?? { segment: seg, items: [] };
    bucket.items.push({ ...agg, account });
    buckets.set(seg, bucket);
  }

  // 5. Para cada segmento, calcular percentil de ticket e dividir em tiers
  const clusters: IntelligenceICP[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.items.length < 2) {
      // segmento muito pequeno → cluster único standard
      clusters.push(buildCluster(bucket.segment, 'standard', bucket.items));
      continue;
    }
    const tickets = bucket.items
      .map(i => (i.deals > 0 ? i.revenue / i.deals : 0))
      .sort((a, b) => a - b);
    const p75 = tickets[Math.floor(tickets.length * 0.75)] ?? 0;

    const premium: typeof bucket.items = [];
    const recurring: typeof bucket.items = [];
    const standard: typeof bucket.items = [];
    const oneShot: typeof bucket.items = [];

    for (const item of bucket.items) {
      const ticket = item.deals > 0 ? item.revenue / item.deals : 0;
      const isHighTicket = ticket >= p75 && p75 > 0;
      const isRecurring = item.deals >= 2;
      if (isHighTicket && isRecurring) premium.push(item);
      else if (isRecurring) recurring.push(item);
      else if (isHighTicket) standard.push(item);
      else oneShot.push(item);
    }

    if (premium.length) clusters.push(buildCluster(bucket.segment, 'premium', premium));
    if (recurring.length) clusters.push(buildCluster(bucket.segment, 'recurring', recurring));
    if (standard.length) clusters.push(buildCluster(bucket.segment, 'standard', standard));
    if (oneShot.length >= 3) clusters.push(buildCluster(bucket.segment, 'one_shot', oneShot));
  }

  return clusters.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function buildCluster(
  segment: string,
  tier: IntelligenceICP['tier'],
  items: Array<{ accountId: string; revenue: number; deals: number; account: AccountRow }>,
): IntelligenceICP {
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  const wonDeals = items.reduce((s, i) => s + i.deals, 0);
  const avgTicket = wonDeals > 0 ? totalRevenue / wonDeals : 0;
  const ltv = items.length > 0 ? totalRevenue / items.length : 0;
  const repeaters = items.filter(i => i.deals >= 2).length;
  const repurchaseRate = items.length > 0 ? (repeaters / items.length) * 100 : 0;

  const cities = topBy(items.map(i => i.account.cidade));
  const states = topBy(items.map(i => i.account.uf));

  const id = `${segment.toLowerCase().replace(/\s+/g, '_')}__${tier}`;
  return {
    id,
    name: `${segment} ${tierLabel(tier)}`,
    segment,
    tier,
    count: items.length,
    totalRevenue,
    avgTicket,
    ltv,
    repurchaseRate,
    wonDeals,
    topCities: cities.map(c => ({ city: c.key as string, count: c.count })),
    topStates: states.map(s => ({ state: s.key as string, count: s.count })),
    filterHints: {
      segment,
      city: cities[0]?.key as string | undefined,
      state: states[0]?.key as string | undefined,
    },
  };
}
