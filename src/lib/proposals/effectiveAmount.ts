/**
 * Centralized utilities for proposal "current value" decision logic.
 * Used by the Opportunity → Propostas tab. Pure functions, no side effects,
 * safe for IA agents and edge consumption.
 */

export type CommercialStatus =
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'expiring_soon'
  | 'engaged'
  | 'viewed'
  | 'sent'
  | 'draft';

export type EffectiveSource = 'approved' | 'dynamic' | 'expected' | 'total';

export interface EffectiveAmount {
  value: number;
  source: EffectiveSource;
  originalValue: number;
  adjustmentPct: number | null; // % vs original (positive = up)
}

export interface DynamicAdjustment {
  applied: boolean;
  pct: number | null;
  tierName?: string | null;
  status?: string | null;
}

export interface NextAction {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  cta?: 'call' | 'followup' | 'resend' | 'duplicate' | 'register_loss' | 'await' | 'none';
}

const ACTIVE_DYNAMIC_STATUSES = new Set([
  'active',
  'current',
  'vigente',
  'approved',
  'aprovado',
]);

function isDynamicActive(p: any): boolean {
  if (!p?.dynamic_pricing_enabled) return false;
  const s = p?.dynamic_pricing_status
    ? String(p.dynamic_pricing_status).toLowerCase()
    : null;
  return !s || ACTIVE_DYNAMIC_STATUSES.has(s);
}

export function getEffectiveAmount(proposal: any): EffectiveAmount {
  const total = Number(proposal?.total_amount) || Number(proposal?.value) || 0;
  const approved = Number(proposal?.approved_amount) || 0;
  const expected = Number(proposal?.payment_expected_amount) || 0;
  const dynCurrent = Number(proposal?.dynamic_pricing_current_amount) || 0;
  const snapCurrent =
    Number(proposal?.dynamic_pricing_snapshot?.current_amount) || 0;

  const dynActive = isDynamicActive(proposal);

  let value = total;
  let source: EffectiveSource = 'total';

  if (proposal?.status === 'accepted' && approved > 0) {
    value = approved;
    source = 'approved';
  } else if (dynActive && dynCurrent > 0) {
    value = dynCurrent;
    source = 'dynamic';
  } else if (dynActive && snapCurrent > 0) {
    value = snapCurrent;
    source = 'dynamic';
  } else if (expected > 0) {
    value = expected;
    source = 'expected';
  }

  const originalValue = total || value;
  const adjustmentPct =
    originalValue > 0 && value !== originalValue
      ? ((value - originalValue) / originalValue) * 100
      : null;

  return { value, source, originalValue, adjustmentPct };
}

export function getDynamicAdjustment(proposal: any): DynamicAdjustment {
  const dynActive = isDynamicActive(proposal);
  if (!dynActive) {
    return { applied: false, pct: null, status: proposal?.dynamic_pricing_status ?? null };
  }
  const eff = getEffectiveAmount(proposal);
  const snap = proposal?.dynamic_pricing_snapshot;
  return {
    applied: true,
    pct: eff.adjustmentPct,
    tierName: snap?.current_label ?? snap?.tier_name ?? null,
    status: proposal?.dynamic_pricing_status ?? 'active',
  };
}

const HOUR_MS = 60 * 60 * 1000;

export function getCommercialStatus(proposal: any, now: Date = new Date()): CommercialStatus {
  const status = String(proposal?.status ?? '').toLowerCase();
  if (status === 'accepted') return 'accepted';
  if (status === 'rejected' || status === 'lost' || status === 'declined') return 'rejected';

  const expiresAt = proposal?.expires_at ? new Date(proposal.expires_at) : null;
  if (status === 'expired' || (expiresAt && expiresAt.getTime() < now.getTime())) {
    return 'expired';
  }

  if (expiresAt) {
    const diffH = (expiresAt.getTime() - now.getTime()) / HOUR_MS;
    if (diffH > 0 && diffH <= 48) return 'expiring_soon';
  }

  const views = Number(proposal?.views_count) || 0;
  if (views >= 3) return 'engaged';
  if (views >= 1) return 'viewed';

  if (status === 'sent') return 'sent';
  return 'draft';
}

export function getCommercialStatusLabel(s: CommercialStatus): string {
  return {
    accepted: 'Aceita',
    rejected: 'Recusada',
    expired: 'Vencida',
    expiring_soon: 'Perto do vencimento',
    engaged: 'Engajada',
    viewed: 'Visualizada',
    sent: 'Enviada',
    draft: 'Rascunho',
  }[s];
}

export function getCommercialStatusTone(s: CommercialStatus): NextAction['tone'] {
  switch (s) {
    case 'accepted':
      return 'success';
    case 'rejected':
    case 'expired':
      return 'danger';
    case 'expiring_soon':
      return 'warning';
    case 'engaged':
    case 'viewed':
    case 'sent':
      return 'info';
    default:
      return 'muted';
  }
}

export function getNextAction(proposal: any, now: Date = new Date()): NextAction {
  const s = getCommercialStatus(proposal, now);
  switch (s) {
    case 'accepted':
      return {
        label: 'Aceita. Aguardar pagamento ou iniciar operação.',
        tone: 'success',
        cta: 'await',
      };
    case 'rejected':
      return {
        label: 'Recusada. Registre o motivo de perda.',
        tone: 'danger',
        cta: 'register_loss',
      };
    case 'expired':
      return {
        label: 'Vencida. Duplique com nova condição.',
        tone: 'danger',
        cta: 'duplicate',
      };
    case 'expiring_soon':
      return {
        label: 'Vence em menos de 48h. Faça follow up agora.',
        tone: 'warning',
        cta: 'followup',
      };
    case 'engaged':
      return {
        label: 'Cliente engajado. Ligue agora para fechar.',
        tone: 'info',
        cta: 'call',
      };
    case 'viewed':
      return {
        label: 'Cliente visualizou. Acione com follow up.',
        tone: 'info',
        cta: 'followup',
      };
    case 'sent':
      return {
        label: 'Enviada sem visualização. Reenvie ou confirme recebimento.',
        tone: 'info',
        cta: 'resend',
      };
    default:
      return {
        label: 'Rascunho. Finalize e envie ao cliente.',
        tone: 'muted',
        cta: 'none',
      };
  }
}

export interface ProposalsBreakdown {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  accepted: number;
  rejected: number;
  expired: number;
  expiringSoon: number;
}

export function getProposalsBreakdown(proposals: any[], now: Date = new Date()): ProposalsBreakdown {
  const b: ProposalsBreakdown = {
    total: proposals.length,
    draft: 0,
    sent: 0,
    viewed: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    expiringSoon: 0,
  };
  for (const p of proposals) {
    const s = getCommercialStatus(p, now);
    if (s === 'accepted') b.accepted++;
    else if (s === 'rejected') b.rejected++;
    else if (s === 'expired') b.expired++;
    else if (s === 'expiring_soon') b.expiringSoon++;
    else if (s === 'engaged' || s === 'viewed') b.viewed++;
    else if (s === 'sent') b.sent++;
    else b.draft++;
  }
  return b;
}

/**
 * Picks the proposal that represents the "current commercial offer" for an opportunity.
 * Priority: accepted → most-recent non-rejected → most recent.
 */
export function pickActiveProposal<T extends { status?: string | null; created_at?: string | null }>(
  proposals: T[],
): T | null {
  if (!proposals.length) return null;
  const accepted = proposals.find((p) => p.status === 'accepted');
  if (accepted) return accepted;
  const nonRejected = proposals.filter(
    (p) => !['rejected', 'lost', 'declined'].includes(String(p.status ?? '').toLowerCase()),
  );
  const pool = nonRejected.length ? nonRejected : proposals;
  return [...pool].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  })[0];
}

export function formatBRL(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0);
}

export function formatPct(pct: number | null): string {
  if (pct == null || !isFinite(pct)) return '0%';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%`;
}
