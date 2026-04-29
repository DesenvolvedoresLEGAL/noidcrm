import { supabase } from '@/integrations/supabase/client';
import { fetchRuntimeLogs, type RuntimeLogRow } from '@/services/crm/dynamicDashboardRuntimeLogs';
import { getDynamicDashboardFeedbackSummary, type FeedbackSummary } from '@/services/crm/dynamicDashboardFeedback';

const DAY_MS = 24 * 60 * 60 * 1000;

export type RolloutStatus = 'safe' | 'attention' | 'blocked';
export type AdoptionStatus = 'adotando' | 'testando' | 'resistencia' | 'sem_uso';
export type DecisionStatus = 'ready' | 'attention' | 'hold';
export type PerformanceStatus = 'good' | 'attention' | 'slow';

export interface CloserHealthSummary {
  activePilots: number;
  allowedCount: number;
  choseLegacyCount: number;
  fallbackCount: number;
  errorCount: number;
  returnedToDynamicCount: number;
  avgLoadMs: number | null;
  fallbackRate: number;
  errorRate: number;
  lastAllowedAt: string | null;
  lastAllowedUserId: string | null;
  lastAllowedUserName: string | null;
  status: RolloutStatus;
  statusReasons: string[];
}

export interface CloserAdoptionRow {
  userId: string;
  fullName: string | null;
  email: string | null;
  lastAllowedAt: string | null;
  allowedCount: number;
  choseLegacyCount: number;
  returnedToDynamicCount: number;
  usageRate: number | null;
  status: AdoptionStatus;
}

export interface CloserPerformanceSummary {
  avgGateMs: number | null;
  avgShellMs: number | null;
  avgCloserDataMs: number | null;
  avgPaceMs: number | null;
  avgTotalInteractiveMs: number | null;
  maxTotalInteractiveMs: number | null;
  slowCount: number;
  attentionCount: number;
  goodCount: number;
}

export interface CloserRolloutDecision {
  status: DecisionStatus;
  reasons: string[];
  metrics: {
    errors: number;
    fallbackRate: number;
    avgTotalInteractiveMs: number | null;
    feedbackAvgRating: number | null;
    runtimeAllowed: number;
  };
}

export interface ActiveCloserPilot {
  userId: string;
  fullName: string | null;
  email: string | null;
}

export interface EligibleCloser {
  userId: string;
  fullName: string | null;
  email: string | null;
  requiresReview: boolean;
  status: string | null;
}

// ---------- helpers ----------

function rateOf(num: number, denom: number): number {
  if (!denom) return 0;
  return num / denom;
}

async function fetchRecentRuntimeLogs(
  tenantId: string,
  days: number,
): Promise<RuntimeLogRow[]> {
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data, error } = await (supabase as any)
    .from('crm_dynamic_dashboard_runtime_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error || !data) return [];
  return data as RuntimeLogRow[];
}

async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { full_name: string | null; email: string | null }>();
  const { data } = await (supabase as any)
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', userIds);
  const map = new Map<string, { full_name: string | null; email: string | null }>();
  for (const r of (data ?? []) as any[]) {
    map.set(r.user_id, { full_name: r.full_name ?? null, email: r.email ?? null });
  }
  return map;
}

// ---------- public API ----------

export async function getActiveCloserPilots(tenantId: string): Promise<ActiveCloserPilot[]> {
  const { data, error } = await (supabase as any)
    .from('crm_user_context_view')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('business_function_key', 'closer')
    .eq('is_dashboard_dynamic_enabled', true);
  if (error || !data) return [];
  const ids = (data as any[]).map((r) => r.user_id);
  const profiles = await fetchProfilesByIds(ids);
  return ids.map((id) => ({
    userId: id,
    fullName: profiles.get(id)?.full_name ?? null,
    email: profiles.get(id)?.email ?? null,
  }));
}

export async function getEligibleClosers(tenantId: string): Promise<EligibleCloser[]> {
  const { data, error } = await (supabase as any)
    .from('crm_user_context_view')
    .select('user_id, status, metadata, is_dashboard_dynamic_enabled')
    .eq('tenant_id', tenantId)
    .eq('business_function_key', 'closer');
  if (error || !data) return [];
  const rows = (data as any[]).filter((r) => !r.is_dashboard_dynamic_enabled);
  const ids = rows.map((r) => r.user_id);
  const profiles = await fetchProfilesByIds(ids);
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: profiles.get(r.user_id)?.full_name ?? null,
    email: profiles.get(r.user_id)?.email ?? null,
    requiresReview: !!(r.metadata?.requires_review),
    status: r.status ?? null,
  }));
}

export async function getCloserDashboardHealthSummary(
  tenantId: string,
  days = 7,
): Promise<CloserHealthSummary> {
  const [logs, activePilots, feedback] = await Promise.all([
    fetchRecentRuntimeLogs(tenantId, days),
    getActiveCloserPilots(tenantId),
    getDynamicDashboardFeedbackSummary(tenantId),
  ]);

  let allowedCount = 0;
  let fallbackCount = 0;
  let errorCount = 0;
  let choseLegacyCount = 0;
  let returnedToDynamicCount = 0;
  const allowedLoads: number[] = [];
  let lastAllowedAt: string | null = null;
  let lastAllowedUserId: string | null = null;

  for (const r of logs) {
    switch (r.event_type) {
      case 'runtime_allowed':
        allowedCount++;
        if (r.load_ms != null) allowedLoads.push(r.load_ms);
        if (!lastAllowedAt || r.created_at > lastAllowedAt) {
          lastAllowedAt = r.created_at;
          lastAllowedUserId = r.user_id;
        }
        break;
      case 'runtime_fallback':
        fallbackCount++;
        break;
      case 'runtime_error':
        errorCount++;
        break;
      case 'user_chose_legacy_dashboard':
        choseLegacyCount++;
        break;
      case 'user_returned_to_dynamic_dashboard':
        returnedToDynamicCount++;
        break;
    }
  }

  const totalAttempts = allowedCount + fallbackCount + errorCount;
  const fallbackRate = rateOf(fallbackCount, totalAttempts);
  const errorRate = rateOf(errorCount, totalAttempts);
  const avgLoadMs = allowedLoads.length
    ? Math.round(allowedLoads.reduce((a, b) => a + b, 0) / allowedLoads.length)
    : null;

  let lastAllowedUserName: string | null = null;
  if (lastAllowedUserId) {
    const profiles = await fetchProfilesByIds([lastAllowedUserId]);
    lastAllowedUserName = profiles.get(lastAllowedUserId)?.full_name ?? null;
  }

  // Status de rollout (tenant)
  const reasons: string[] = [];
  let status: RolloutStatus = 'safe';

  // Blocked
  if (errorCount >= 3) {
    status = 'blocked';
    reasons.push('Erros runtime recorrentes (>=3 em 7d).');
  }
  if (fallbackRate > 0.25) {
    status = 'blocked';
    reasons.push('Taxa de fallback acima de 25%.');
  }
  if (avgLoadMs != null && avgLoadMs > 5000) {
    status = 'blocked';
    reasons.push('Tempo médio de carregamento acima de 5s.');
  }
  if (feedback.avgRating != null && feedback.avgRating <= 2) {
    status = 'blocked';
    reasons.push('Feedback médio igual ou abaixo de 2.');
  }

  if (status !== 'blocked') {
    if (errorCount > 0) {
      status = 'attention';
      reasons.push('Há erros runtime registrados.');
    }
    if (fallbackRate >= 0.1 && fallbackRate <= 0.25) {
      status = 'attention';
      reasons.push('Fallback entre 10% e 25%.');
    }
    if (avgLoadMs != null && avgLoadMs >= 3000 && avgLoadMs <= 5000) {
      status = 'attention';
      reasons.push('Tempo médio entre 3s e 5s.');
    }
    if (choseLegacyCount > 2) {
      status = 'attention';
      reasons.push('Usuários voltaram ao legado mais de 2 vezes.');
    }
  }

  if (status === 'safe' && allowedCount === 0) {
    reasons.push('Nenhum acesso runtime ainda.');
  }

  return {
    activePilots: activePilots.length,
    allowedCount,
    choseLegacyCount,
    fallbackCount,
    errorCount,
    returnedToDynamicCount,
    avgLoadMs,
    fallbackRate,
    errorRate,
    lastAllowedAt,
    lastAllowedUserId,
    lastAllowedUserName,
    status,
    statusReasons: reasons,
  };
}

export async function getCloserDashboardUserAdoption(
  tenantId: string,
  days = 7,
): Promise<CloserAdoptionRow[]> {
  const [logs, pilots] = await Promise.all([
    fetchRecentRuntimeLogs(tenantId, days),
    getActiveCloserPilots(tenantId),
  ]);

  const byUser = new Map<string, {
    allowed: number;
    choseLegacy: number;
    returned: number;
    lastAllowedAt: string | null;
  }>();

  for (const p of pilots) {
    byUser.set(p.userId, { allowed: 0, choseLegacy: 0, returned: 0, lastAllowedAt: null });
  }

  for (const r of logs) {
    const cur = byUser.get(r.user_id);
    if (!cur) continue;
    if (r.event_type === 'runtime_allowed') {
      cur.allowed++;
      if (!cur.lastAllowedAt || r.created_at > cur.lastAllowedAt) cur.lastAllowedAt = r.created_at;
    } else if (r.event_type === 'user_chose_legacy_dashboard') {
      cur.choseLegacy++;
    } else if (r.event_type === 'user_returned_to_dynamic_dashboard') {
      cur.returned++;
    }
  }

  return pilots.map((p) => {
    const c = byUser.get(p.userId)!;
    const denom = c.allowed + c.choseLegacy;
    const usageRate = denom > 0 ? c.allowed / denom : null;
    let status: AdoptionStatus = 'sem_uso';
    if (c.allowed === 0) status = 'sem_uso';
    else if (c.choseLegacy > c.allowed) status = 'resistencia';
    else if (usageRate != null && usageRate >= 0.7 && c.allowed >= 3) status = 'adotando';
    else if (c.allowed >= 1 && c.allowed <= 2) status = 'testando';
    else status = 'testando';

    return {
      userId: p.userId,
      fullName: p.fullName,
      email: p.email,
      lastAllowedAt: c.lastAllowedAt,
      allowedCount: c.allowed,
      choseLegacyCount: c.choseLegacy,
      returnedToDynamicCount: c.returned,
      usageRate,
      status,
    };
  });
}

export async function getCloserDashboardPerformanceSummary(
  tenantId: string,
  days = 7,
): Promise<CloserPerformanceSummary> {
  const logs = await fetchRecentRuntimeLogs(tenantId, days);
  const allowed = logs.filter((l) => l.event_type === 'runtime_allowed');

  const gates: number[] = [];
  const shells: number[] = [];
  const closerData: number[] = [];
  const pace: number[] = [];
  const total: number[] = [];
  let slow = 0;
  let attention = 0;
  let good = 0;

  for (const l of allowed) {
    const m = l.metadata ?? {};
    const g = num(m.gate_load_ms); if (g != null) gates.push(g);
    const s = num(m.shell_render_ms); if (s != null) shells.push(s);
    const cd = num(m.closer_data_load_ms); if (cd != null) closerData.push(cd);
    const p = num(m.pace_load_ms); if (p != null) pace.push(p);
    const t = num(m.total_interactive_ms); if (t != null) total.push(t);
    const ps = m.performance_status;
    if (ps === 'slow') slow++;
    else if (ps === 'attention') attention++;
    else if (ps === 'good') good++;
  }

  return {
    avgGateMs: avg(gates),
    avgShellMs: avg(shells),
    avgCloserDataMs: avg(closerData),
    avgPaceMs: avg(pace),
    avgTotalInteractiveMs: avg(total),
    maxTotalInteractiveMs: total.length ? Math.max(...total) : null,
    slowCount: slow,
    attentionCount: attention,
    goodCount: good,
  };
}

function num(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export async function getCloserRolloutDecisionData(
  tenantId: string,
  days = 7,
): Promise<CloserRolloutDecision> {
  const [health, perf, feedback] = await Promise.all([
    getCloserDashboardHealthSummary(tenantId, days),
    getCloserDashboardPerformanceSummary(tenantId, days),
    getDynamicDashboardFeedbackSummary(tenantId),
  ]);

  const errors = health.errorCount;
  const fallbackRate = health.fallbackRate;
  const avgInteractive = perf.avgTotalInteractiveMs;
  const fbAvg = feedback.avgRating;
  const allowed = health.allowedCount;

  const reasons: string[] = [];
  let status: DecisionStatus = 'ready';

  // Hold
  if (errors > 2) { status = 'hold'; reasons.push('Mais de 2 erros runtime.'); }
  if (fallbackRate > 0.25) { status = 'hold'; reasons.push('Fallback acima de 25%.'); }
  if (avgInteractive != null && avgInteractive > 5000) { status = 'hold'; reasons.push('Tempo total interativo acima de 5s.'); }
  if (fbAvg != null && fbAvg < 3) { status = 'hold'; reasons.push('Feedback médio abaixo de 3.'); }

  if (status !== 'hold') {
    if (errors >= 1 && errors <= 2) { status = 'attention'; reasons.push('Erros runtime entre 1 e 2.'); }
    if (fallbackRate >= 0.1 && fallbackRate <= 0.25) { status = 'attention'; reasons.push('Fallback entre 10% e 25%.'); }
    if (avgInteractive != null && avgInteractive >= 3000 && avgInteractive <= 5000) { status = 'attention'; reasons.push('Tempo interativo entre 3s e 5s.'); }
    if (fbAvg != null && fbAvg >= 3 && fbAvg < 4) { status = 'attention'; reasons.push('Feedback médio entre 3 e 4.'); }
  }

  // Ready confirma
  if (status === 'ready') {
    if (allowed < 3) { status = 'attention'; reasons.push('Menos de 3 acessos runtime registrados.'); }
    else if (fbAvg == null) { status = 'attention'; reasons.push('Sem feedback ainda.'); }
    else {
      reasons.push('Performance dentro do limite.');
      reasons.push('Nenhum erro runtime encontrado.');
      if (fbAvg >= 4) reasons.push('Feedback médio igual ou acima de 4.');
    }
  }

  if (allowed === 0 && status !== 'hold') {
    reasons.push('Ainda não há dados suficientes.');
  }

  return {
    status,
    reasons,
    metrics: {
      errors,
      fallbackRate,
      avgTotalInteractiveMs: avgInteractive,
      feedbackAvgRating: fbAvg,
      runtimeAllowed: allowed,
    },
  };
}

export { fetchRuntimeLogs };
export type { FeedbackSummary };
