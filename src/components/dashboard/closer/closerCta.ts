import type { CloserItemKind, CloserSeverity } from '@/types/dashboard/closer';

// Real, validated routes (declared in src/App.tsx). Anything else returns null
// so the UI can render a disabled CTA with tooltip.
export function buildCloserCtaHref(
  kind: CloserItemKind | 'opportunity_id',
  id?: string | null,
  opportunityId?: string | null,
): string | null {
  if (kind === 'activity') {
    return opportunityId ? `/app/opportunities/${opportunityId}` : '/app/activities';
  }
  if (kind === 'proposal') {
    return id ? `/app/proposals/${id}/edit` : null;
  }
  if (kind === 'opportunity' || kind === 'opportunity_id') {
    return opportunityId ? `/app/opportunities/${opportunityId}` : null;
  }
  return null;
}

export const SEVERITY_LABEL: Record<CloserSeverity, string> = {
  critical: 'Crítico',
  attention: 'Atenção',
  opportunity: 'Oportunidade',
  info: 'Informativo',
};

// Maps to existing Badge variants; falls back to outline.
export function severityBadgeVariant(s: CloserSeverity): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (s) {
    case 'critical': return 'destructive';
    case 'attention': return 'default';
    case 'opportunity': return 'secondary';
    default: return 'outline';
  }
}
